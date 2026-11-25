import { api } from './api';
import { useLoad } from './useLoad';

// Gather records from courses the signed-in user is allowed to access.
// All calls pass through the existing authenticated API wrapper.
export function useCourseItems(resource) {
  return useLoad(async () => {
    const courses = await api.get('/courses');
    const results = await Promise.allSettled(
      courses.map((course) => api.get(`/courses/${course.id}/${resource}`))
    );
    const unavailable = [];
    const items = [];
    results.forEach((result, index) => {
      const course = courses[index];
      if (result.status === 'fulfilled') {
        result.value.forEach((item) => items.push({
          ...item,
          course_id: course.id,
          course_code: course.code,
          course_title: course.title,
          course_role: course.my_role,
        }));
      } else {
        unavailable.push({ course: course.code, message: result.reason?.message || 'Could not load this course' });
      }
    });
    return { courses, items, unavailable };
  }, [resource]);
}
