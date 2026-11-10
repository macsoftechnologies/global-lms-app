import React from 'react';
import TermProgramsScreen from './term-programs';

/**
 * TermCoursesScreen
 * 
 * Route: /student/term-courses
 * Renders the dedicated Term-Wise Courses view with live backend integration,
 * purchase-based access status, and direct navigation to Course Learning.
 */
export default function TermCoursesScreen() {
  return <TermProgramsScreen initialMode="courses" />;
}

