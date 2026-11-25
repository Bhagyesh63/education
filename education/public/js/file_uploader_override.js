/**
 * Global FileUploader Customization
 *
 * Ensures all attachments (sidebar, attach fields, etc.) across all DocTypes:
 * 1. Hide the "Private" checkbox in the upload modal (user cannot see or toggle it).
 * 2. Hide the "Set all private" / "Set all public" action button in the dialog footer.
 * 3. Always upload files in private mode (is_private = 1).
 *
 * Implemented cleanly in the education app without modifying Frappe or ERPNext core.
 */

;(function () {
  // Inject CSS fallback immediately
  const styleId = 'frappe-enforce-private-upload-style'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
			/* Hide secondary button (Set all private / Set all public) in upload dialogs */
			.modal:has(.file-uploader) .modal-footer .btn-secondary,
			.modal[data-modal-name*="Upload"] .modal-footer .btn-secondary,
			.modal.file-uploader-dialog .modal-footer .btn-secondary {
				display: none !important;
			}
		`
    ;(document.head || document.documentElement).appendChild(style)
  }

  const proxyHandler = {
    construct(target, args) {
      let opts = args[0] || {}

      // Force always private mode and disable toggling private
      opts.make_attachments_public = 0
      opts.allow_toggle_private = false
      args[0] = opts

      const instance = Reflect.construct(target, args)

      // Disable toggle_all_private
      if (instance && instance.uploader) {
        instance.uploader.toggle_all_private = function () {}
      }

      // Hide secondary action button in upload dialog footer
      if (instance && instance.dialog) {
        const hideSecondaryBtn = () => {
          try {
            const btn = instance.dialog.get_secondary_btn?.()
            if (btn && btn.length) {
              btn.hide()
              btn.css({ display: 'none' })
            }
          } catch (e) {
            // pass
          }
        }

        hideSecondaryBtn()
        setTimeout(hideSecondaryBtn, 0)
        setTimeout(hideSecondaryBtn, 50)
        setTimeout(hideSecondaryBtn, 150)
        setTimeout(hideSecondaryBtn, 300)

        // Prevent watcher on uploader.files from making the secondary button visible
        const originalSetSecLabel =
          instance.dialog.set_secondary_action_label?.bind(instance.dialog)
        instance.dialog.set_secondary_action_label = function (...labelArgs) {
          if (originalSetSecLabel) {
            originalSetSecLabel(...labelArgs)
          }
          hideSecondaryBtn()
        }
      }

      return instance
    },
  }

  function wrapWithProxy(Uploader) {
    if (!Uploader || Uploader._is_custom_proxy) return Uploader
    try {
      const proxied = new Proxy(Uploader, proxyHandler)
      proxied._is_custom_proxy = true
      return proxied
    } catch (e) {
      return Uploader
    }
  }

  if (!window.frappe) window.frappe = {}
  if (!frappe.ui) frappe.ui = {}

  let _currentUploader = frappe.ui.FileUploader
  if (_currentUploader) {
    _currentUploader = wrapWithProxy(_currentUploader)
  }

  try {
    Object.defineProperty(frappe.ui, 'FileUploader', {
      get() {
        return _currentUploader
      },
      set(val) {
        _currentUploader = wrapWithProxy(val)
      },
      configurable: true,
      enumerable: true,
    })
  } catch (e) {
    frappe.ui.FileUploader = wrapWithProxy(frappe.ui.FileUploader)
  }

  // Global DOM fallback: Watch for any file uploader modals and ensure private checkbox/button are hidden
  function checkAndCleanFileUploaderDOM(root) {
    if (!root || !root.querySelectorAll) return
    const uploaders = root.querySelectorAll('.file-uploader')
    if (!uploaders.length) return

    uploaders.forEach((uploaderEl) => {
      const modalEl = uploaderEl.closest('.modal')
      if (modalEl) {
        const secBtn = modalEl.querySelector('.modal-footer .btn-secondary')
        if (secBtn) {
          secBtn.style.display = 'none'
        }
      }

      // If any label in config-area has text "Private", hide it
      const labels = uploaderEl.querySelectorAll(
        '.config-area label.frappe-checkbox'
      )
      labels.forEach((label) => {
        if (
          label.textContent &&
          label.textContent.trim().toLowerCase().includes('private')
        ) {
          label.style.display = 'none'
        }
      })
    })
  }

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            checkAndCleanFileUploaderDOM(node)
          }
        }
      }
    })
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    })
  }
})()
