from app.services.uid_registry import mint_student_uid


def test_mint_student_uid_prefix():
    uid = mint_student_uid()
    assert uid.startswith("STU-")
    assert len(uid) > 10
