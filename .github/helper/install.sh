#!/bin/bash

set -e

cd ~ || exit

step() { echo "::endgroup::"; echo "::group::$*"; }
echo "::group::start"

# Anonymous git-over-HTTPS from runners gets throttled (401 mid-clone, see erpnext's CI):
# authenticate clones with the job token via a credential helper that never stores it.
if [ -n "${GITHUB_TOKEN:-}" ]; then
    export CI_GITHUB_TOKEN="$GITHUB_TOKEN"
    export GIT_CONFIG_COUNT=3
    export GIT_CONFIG_KEY_0="credential.helper"
    export GIT_CONFIG_VALUE_0=""
    export GIT_CONFIG_KEY_1="credential.https://github.com.username"
    export GIT_CONFIG_VALUE_1="x-access-token"
    export GIT_CONFIG_KEY_2="credential.https://github.com.helper"
    export GIT_CONFIG_VALUE_2='!f() { test "$1" = get && echo "password=$CI_GITHUB_TOKEN"; }; f'
fi
export GIT_TERMINAL_PROMPT=0

step "system packages"
sudo apt-get update
sudo apt-get remove -y mysql-server mysql-client || true
# libmariadb-dev + pkg-config: Frappe v16 builds the mysqlclient driver
sudo apt-get install -y libcups2-dev redis-server mariadb-client libmariadb-dev pkg-config

step "frappe-bench"
pip install frappe-bench

# This fork tracks Frappe/ERPNext v16 whatever its own branch is called (main, version-16, ...),
# so upstream apps are always cloned from FRAPPE_BRANCH, not from this repo's branch name.
FRAPPE_BRANCH="${FRAPPE_BRANCH:-version-16}"

step "frappe ($FRAPPE_BRANCH) + bench init"
git clone https://github.com/frappe/frappe --branch "$FRAPPE_BRANCH" --depth 1
bench init --skip-assets --frappe-path ~/frappe --python "$(which python)" frappe-bench

step "test site + database"
mkdir ~/frappe-bench/sites/test_site
cp -r "${GITHUB_WORKSPACE}/.github/helper/site_config.json" ~/frappe-bench/sites/test_site/

mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "SET GLOBAL character_set_server = 'utf8mb4'"
mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "SET GLOBAL collation_server = 'utf8mb4_unicode_ci'"

mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "CREATE USER 'test_frappe'@'localhost' IDENTIFIED BY 'test_frappe'"
mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "CREATE DATABASE test_frappe"
mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "GRANT ALL PRIVILEGES ON \`test_frappe\`.* TO 'test_frappe'@'localhost'"

mariadb --host 127.0.0.1 --port 3306 -u root -proot -e "FLUSH PRIVILEGES"

install_whktml() {
    wget -O /tmp/wkhtmltox.tar.xz https://github.com/frappe/wkhtmltopdf/raw/master/wkhtmltox-0.12.3_linux-generic-amd64.tar.xz
    tar -xf /tmp/wkhtmltox.tar.xz -C /tmp
    sudo mv /tmp/wkhtmltox/bin/wkhtmltopdf /usr/local/bin/wkhtmltopdf
    sudo chmod o+x /usr/local/bin/wkhtmltopdf
}
install_whktml &

cd ~/frappe-bench || exit

sed -i 's/watch:/# watch:/g' Procfile
sed -i 's/schedule:/# schedule:/g' Procfile
sed -i 's/socketio:/# socketio:/g' Procfile
sed -i 's/redis_socketio:/# redis_socketio:/g' Procfile

step "apps: payments, erpnext, education"
bench get-app payments --branch "$FRAPPE_BRANCH"
bench get-app https://github.com/frappe/erpnext --branch "$FRAPPE_BRANCH" --resolve-deps
bench get-app education "${GITHUB_WORKSPACE}"
step "requirements + build"
bench setup requirements --dev
bench build

step "install apps on test_site"
bench start &>> ~/frappe-bench/bench_start.log &
CI=Yes bench build --app frappe &
bench --site test_site reinstall --yes

bench --verbose --site test_site install-app payments
bench --verbose --site test_site install-app education
echo "::endgroup::"
