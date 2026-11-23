import frappe
import traceback
import json
from frappe.utils import today, add_days

def test_full_academic_lifecycle():
    print("=" * 60)
    print("STARTING END-TO-END ACADEMIC LIFECYCLE FLOW VERIFICATION")
    print("=" * 60)

    results = {}
    try:
        # -------------------------------------------------------------
        # 0. SETUP TEST STUDENT & CONTEXT
        # -------------------------------------------------------------
        stu = frappe.db.get_value("Student", {"student_email_id": "aarav.flow@example.com"}, "name")
        if not stu:
            doc = frappe.new_doc("Student")
            doc.first_name = "Aarav"
            doc.last_name = "Sharma"
            doc.student_email_id = "aarav.flow@example.com"
            doc.gender = "Male"
            doc.date_of_birth = "2015-05-15"
            doc.insert(ignore_permissions=True)
            frappe.db.commit()
            test_student_id = doc.name
            print(f"Created Test Student: {test_student_id} (Aarav Sharma)")
        else:
            test_student_id = stu
            print(f"Using Existing Test Student: {test_student_id} (Aarav Sharma)")

        test_year = "2026-2027"
        test_program = "Standard 5"

        # -------------------------------------------------------------
        # STEP 1 & 2: Program Enrollment -> Automatic Course Enrollment
        # -------------------------------------------------------------
        print("\n--- STEP 1 & 2: PROGRAM ENROLLMENT & AUTO COURSE ENROLLMENT ---")
        existing_pes = frappe.db.get_list("Program Enrollment", filters={"student": test_student_id}, pluck="name")
        for e_pe in existing_pes:
            try:
                pe_doc = frappe.get_doc("Program Enrollment", e_pe)
                if pe_doc.docstatus == 1:
                    pe_doc.cancel()
                pe_doc.delete()
                frappe.db.commit()
                print(f"Cleaned up previous enrollment {e_pe}")
            except Exception as e:
                print(f"Cleanup notice: {e}")

        from education.education.api_modules.students import enroll_student_in_program
        enroll_res = enroll_student_in_program(
            student=test_student_id,
            program=test_program,
            academic_year=test_year,
            academic_term="2026-2027 (Term 1)"
        )
        pe_name = enroll_res["name"]
        print(f"✓ Program Enrollment created & submitted: {pe_name} for {test_student_id} in {test_program}")

        # Verify automatic Course Enrollment creation
        course_enrollments = frappe.db.get_list("Course Enrollment", filters={"program_enrollment": pe_name}, fields=["name", "course", "student"])
        print(f"✓ Automatically created {len(course_enrollments)} Course Enrollments:")
        for ce in course_enrollments:
            print(f"   • {ce.course} (Doc: {ce.name})")

        assert len(course_enrollments) > 0, "No course enrollments were automatically created!"
        results["step_1_2"] = {"success": True, "program_enrollment": pe_name, "course_enrollments_count": len(course_enrollments)}

        # -------------------------------------------------------------
        # STEP 3: Teaching: Student Group + Instructor + Course Schedule
        # -------------------------------------------------------------
        print("\n--- STEP 3: TEACHING (STUDENT GROUP + INSTRUCTOR + TIMETABLE) ---")
        sg_name = "Standard 5 - Section B"
        if not frappe.db.exists("Student Group", sg_name):
            from education.education.api_modules.students import create_student_group
            create_student_group(student_group_name=sg_name, academic_year=test_year, program=test_program, max_strength=40)

        # Assign student to group
        from education.education.api_modules.students import assign_student_to_group
        assign_res = assign_student_to_group(student=test_student_id, student_group=sg_name, roll_number=101)
        print(f"✓ Assigned student to group {sg_name} with roll no: 101 ({assign_res['status']})")

        # Pick an instructor, room, and course
        instructors = frappe.db.get_list("Instructor", fields=["name", "instructor_name"], limit=1)
        instructor = instructors[0].name if instructors else None
        rooms = frappe.db.get_list("Room", fields=["name"], limit=1)
        room = rooms[0].name if rooms else None
        first_course = course_enrollments[0].course

        # Delete any conflicting schedule for this group today
        for csh in frappe.db.get_list("Course Schedule", filters={"student_group": sg_name, "schedule_date": today()}):
            frappe.delete_doc("Course Schedule", csh.name, force=True)
        frappe.db.commit()

        from education.education.api_modules.schedule import create_course_schedule
        schedule_res = create_course_schedule(
            course=first_course,
            student_group=sg_name,
            instructor=instructor,
            schedule_date=today(),
            from_time="10:00:00",
            to_time="11:00:00",
            room=room
        )
        sched_id = schedule_res["name"]
        print(f"✓ Course Schedule created: {sched_id} for course '{first_course}' with instructor '{instructor}' at {room}")
        results["step_3"] = {"success": True, "student_group": sg_name, "schedule_id": sched_id}

        # -------------------------------------------------------------
        # STEP 4: Exam Setup: Assessment Group -> Assessment Criteria -> Assessment Plan
        # -------------------------------------------------------------
        print("\n--- STEP 4: EXAM SETUP (ASSESSMENT GROUP -> CRITERIA -> PLAN) ---")
        ass_groups = frappe.db.get_list("Assessment Group", fields=["name"], limit=1)
        ass_group = ass_groups[0].name if ass_groups else "All Assessment Groups"

        # Ensure grading scale
        scales = frappe.db.get_list("Grading Scale", fields=["name"])
        scale_name = "ABC School Grading Scale" if frappe.db.exists("Grading Scale", "ABC School Grading Scale") else (scales[0].name if scales else None)
        print(f"Active Grading Scale: {scale_name}")

        # Ensure assessment criteria
        crit_name = "Class Performance"
        if not frappe.db.exists("Assessment Criteria", crit_name):
            crit = frappe.new_doc("Assessment Criteria")
            crit.assessment_criteria = crit_name
            crit.insert(ignore_permissions=True)
            frappe.db.commit()

        from education.education.api_modules.assessment import create_assessment_plan
        exam_date = add_days(today(), 7)
        # Clean up any existing plan for this course/group/date
        existing_plans = frappe.db.get_list("Assessment Plan", filters={"course": first_course, "student_group": sg_name, "schedule_date": exam_date}, pluck="name")
        for ep in existing_plans:
            try:
                p_doc = frappe.get_doc("Assessment Plan", ep)
                if p_doc.docstatus == 1:
                    p_doc.cancel()
                p_doc.delete()
                frappe.db.commit()
            except Exception as e:
                print(f"Cleanup plan error: {e}")

        plan_res = create_assessment_plan(
            assessment_name=f"Mid-Term Exam - {first_course}",
            course=first_course,
            student_group=sg_name,
            grading_scale=scale_name,
            assessment_group=ass_group,
            schedule_date=exam_date,
            criteria=[{"assessment_criteria": crit_name, "maximum_score": 100.0}]
        )
        plan_name = plan_res["name"]
        print(f"✓ Assessment Plan created: {plan_name} (Scale: {scale_name})")
        results["step_4"] = {"success": True, "plan_name": plan_name, "grading_scale": scale_name}

        # -------------------------------------------------------------
        # STEP 5 & 6: Result Entry & Grade Lookup from Grading Scale DocType
        # -------------------------------------------------------------
        print("\n--- STEP 5 & 6: RESULT ENTRY & GRADING SCALE LOOKUP ---")
        from education.education.api_modules.assessment import mark_assessment_result, submit_assessment_results
        score_given = 85.0
        payload = {
            "student": test_student_id,
            "total_score": score_given,
            "comment": "Strong understanding demonstrated.",
            "assessment_details": {crit_name: score_given}
        }
        result_res = mark_assessment_result(
            assessment_plan=plan_name,
            scores=json.dumps(payload)
        )
        ar_name = result_res["name"]
        computed_grade = result_res["grade"]
        print(f"✓ Assessment Result recorded: {ar_name}")
        print(f"   • Student: {test_student_id}")
        print(f"   • Score: {score_given} / 100")
        print(f"   • Grade looked up from Grading Scale DocType: '{computed_grade}'")
        assert computed_grade in ["A", "A+"], f"Expected Grade A or A+, got {computed_grade}"
        submit_assessment_results(plan_name, sg_name)
        print(f"✓ Assessment Result submitted for official records & report card")
        results["step_5_6"] = {"success": True, "result_id": ar_name, "score": score_given, "grade": computed_grade}

        # -------------------------------------------------------------
        # STEP 7: Viewing: Portal, Grades View, Report Card
        # -------------------------------------------------------------
        print("\n--- STEP 7: VIEWING VIA PORTAL & GRADES VIEW ---")
        from education.education.api_modules.assessment import get_student_assessment_results
        student_results = get_student_assessment_results(test_student_id)
        matched = next((r for r in student_results if r["assessment_plan"] == plan_name), None)
        assert matched is not None, "Newly entered assessment result not visible in student results query!"
        print(f"✓ Student Portal Query retrieved result:")
        print(f"   • Course: {matched['course']}")
        print(f"   • Score: {matched['total_score']} / {matched['maximum_score']}")
        print(f"   • Grade: {matched['grade']}")
        print(f"   • Examiner: {matched.get('examiner')}")
        results["step_7"] = {"success": True, "view_verified": True, "record": matched}

        # -------------------------------------------------------------
        # STEP 8: Decision: Promotion to Next Program (e.g. Standard 6)
        # -------------------------------------------------------------
        print("\n--- STEP 8: DECISIONS (PROMOTION TO NEXT PROGRAM) ---")
        next_program = "Standard 6"
        next_year = "2027-2028"
        # Cleanup existing next year enrollment if any
        for npe in frappe.db.get_list("Program Enrollment", filters={"student": test_student_id, "program": next_program}, pluck="name"):
            try:
                np_doc = frappe.get_doc("Program Enrollment", npe)
                if np_doc.docstatus == 1:
                    np_doc.cancel()
                np_doc.delete()
                frappe.db.commit()
            except Exception as e:
                print(f"Cleanup promo notice: {e}")

        promotion_res = enroll_student_in_program(
            student=test_student_id,
            program=next_program,
            academic_year=next_year,
            academic_term="2027-2028 (Term 1)"
        )
        promo_pe = promotion_res["name"]
        print(f"✓ Student promoted: Enrolled into '{next_program}' for '{next_year}' (Doc: {promo_pe})")
        next_course_enrollments = frappe.db.get_list("Course Enrollment", filters={"program_enrollment": promo_pe}, fields=["name", "course"])
        print(f"✓ Automatically initialized {len(next_course_enrollments)} courses for promoted program '{next_program}':")
        for nce in next_course_enrollments:
            print(f"   • {nce.course}")
        results["step_8"] = {"success": True, "promoted_program": next_program, "new_enrollment": promo_pe}

        print("\n" + "=" * 60)
        print("ALL 8 STEPS OF THE ACADEMIC LIFECYCLE FLOW VERIFIED SUCCESSFULLY!")
        print("=" * 60)
        return results

    except Exception as e:
        print("\n" + "!" * 60)
        print("EXCEPTION IN TEST LIFECYCLE:")
        traceback.print_exc()
        print("!" * 60)
        return {"error": str(e)}

def create_default_plans():
    import traceback
    try:
        from education.education.api_modules.assessment import create_assessment_plan
        from frappe.utils import add_days, today

        created = []
        # Std 6
        if not frappe.db.exists("Assessment Plan", {"course": "Mathematics", "student_group": "Standard 6 - Section A"}):
            p6_math = create_assessment_plan(
                student_group="Standard 6 - Section A",
                course="Mathematics",
                assessment_name="Mid-Term Exam - Mathematics (Std 6)",
                schedule_date=add_days(today(), 14)
            )
            created.append(p6_math["name"])
            print("Created Std 6 Math Plan:", p6_math["name"])

        if not frappe.db.exists("Assessment Plan", {"course": "Science", "student_group": "Standard 6 - Section A"}):
            p6_sci = create_assessment_plan(
                student_group="Standard 6 - Section A",
                course="Science",
                assessment_name="Mid-Term Exam - Science (Std 6)",
                schedule_date=add_days(today(), 15)
            )
            created.append(p6_sci["name"])
            print("Created Std 6 Science Plan:", p6_sci["name"])

        # Std 7
        if not frappe.db.exists("Assessment Plan", {"course": "English", "student_group": "Standard 7 - Section A"}):
            p7_eng = create_assessment_plan(
                student_group="Standard 7 - Section A",
                course="English",
                assessment_name="Mid-Term Exam - English (Std 7)",
                schedule_date=add_days(today(), 16)
            )
            created.append(p7_eng["name"])
            print("Created Std 7 English Plan:", p7_eng["name"])

        return {"created": created}
    except Exception as e:
        print("\n" + "!" * 60)
        print("EXCEPTION IN CREATE DEFAULT PLANS:")
        traceback.print_exc()
        print("!" * 60)
        return {"error": str(e)}

