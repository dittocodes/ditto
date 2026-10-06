import React from 'react';
import { BookOpen } from 'lucide-react';
import { getUid } from '../../../services/studentV1Api';
import TrackerFileUpload from './TrackerFileUpload';

export default function ProfileAcademicProfileCard({ academic, uploadFn }) {
  const a = academic || {};
  const courses = a.courses || [];

  return (
    <section className="tracker-profile-acad-card">
      <div className="tracker-profile-acad-card-head">
        <BookOpen size={22} strokeWidth={1.8} aria-hidden />
        <h2>Academic Profile</h2>
      </div>

      <div className="tracker-profile-acad-details">
        <div className="tracker-profile-acad-row">
          <span>Department</span>
          <strong>{a.department}</strong>
        </div>
        <div className="tracker-profile-acad-row">
          <span>Year</span>
          <strong>{a.year}</strong>
        </div>
        <div className="tracker-profile-acad-row">
          <span>Student ID</span>
          <strong>{a.student_id}</strong>
        </div>
        <div className="tracker-profile-acad-row">
          <span>GPA</span>
          <strong>{a.gpa}/4.0</strong>
        </div>
        <div className="tracker-profile-acad-row">
          <span>Academic Standing</span>
          <span className="tracker-profile-standing-good">{a.standing}</span>
        </div>
      </div>

      <div className="tracker-profile-acad-courses">
        <h3>Current Semester</h3>
        <div className="tracker-profile-course-list">
          {courses.map((c) => (
            <div key={c.name} className="tracker-profile-course-item">
              <div>
                <strong>{c.name}</strong>
                <small>
                  {c.instructor || c.teacher} • {c.schedule || c.time}
                </small>
              </div>
              <span className="tracker-profile-course-grade">{c.grade}</span>
            </div>
          ))}
        </div>
      </div>

      {uploadFn ? (
        <div className="tracker-profile-acad-upload">
          <TrackerFileUpload
            label="Upload academic document"
            accept=".pdf,image/*"
            uploadFn={async (file) => {
              const uid = await getUid();
              return uploadFn(uid, file);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
