import { FINISH_LABEL, formatGrade, scaleOf, scoreAttempt } from './exam';
import type { Exam, ExamAttempt } from './types';

/** A4 portrait, in points. */
export const REPORT_PAGE = { width: 595, height: 842 };

/** Filesystem-safe export name, e.g. "Midterm – grades 2026-11-06". */
export function gradesFileName(title: string) {
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Exam';
  return `${safe} – grades ${new Date().toISOString().slice(0, 10)}`;
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A saved document is read later, so dates are absolute ("6 Nov 2026"), never "Today".
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const when = (iso: string) => `${day(iso)}, ${time(iso)}`;

/** The grade sheet of an exam's finished attempts, as a printable HTML page. */
export function gradesReportHtml(exam: Exam, attempts: ExamAttempt[]) {
  const scale = scaleOf(exam);
  const rows = attempts
    .filter((a) => a.finish)
    .map((a) => ({ attempt: a, score: scoreAttempt(exam, a) }))
    .sort((x, y) => x.attempt.student.name.localeCompare(y.attempt.student.name));
  const grades = rows.filter((r) => !r.score.ungraded).map((r) => r.score.grade);
  const toGrade = rows.length - grades.length;
  const stat = (n: number | null) => (n === null ? '—' : `${formatGrade(n)}/${scale}`);
  const average = grades.length ? grades.reduce((s, g) => s + g, 0) / grades.length : null;

  const body = rows.length
    ? rows.map(({ attempt: a, score: s }, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${escape(a.student.name)}</td>
          <td class="${a.finish === 'submitted' ? '' : 'warn'}">${FINISH_LABEL[a.finish!]}</td>
          <td>${when(a.finishedAt!)}</td>
          <td class="num">${formatGrade(s.earned)}/${formatGrade(s.total)}</td>
          <td class="num grade">${s.ungraded ? '<span class="warn">To grade</span>' : `${formatGrade(s.grade)}/${scale}`}</td>
        </tr>`).join('')
    : '<tr><td colspan="6" class="empty">No one has submitted yet.</td></tr>';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escape(gradesFileName(exam.title))}</title><style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, Roboto, "Segoe UI", Helvetica, Arial, sans-serif; color: #1b1b1f; font-size: 11pt; }
    .course { color: #6b6b75; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.06em; }
    h1 { font-size: 20pt; margin: 4px 0 6px; }
    .meta { color: #6b6b75; font-size: 9.5pt; margin: 0 0 16px; }
    .stats { display: flex; border: 1px solid #e3e1dc; border-radius: 8px; margin-bottom: 18px; }
    .stat { flex: 1; padding: 10px; text-align: center; border-left: 1px solid #e3e1dc; }
    .stat:first-child { border-left: 0; }
    .stat b { display: block; font-size: 14pt; }
    .stat span { color: #6b6b75; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    th { text-align: left; font-size: 9pt; color: #6b6b75; font-weight: 600; border-bottom: 1.5px solid #1b1b1f; padding: 6px; }
    td { padding: 7px 6px; border-bottom: 1px solid #e3e1dc; vertical-align: top; }
    tr { page-break-inside: avoid; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    th.num { text-align: right; }
    .grade { font-weight: 700; }
    .warn { color: #b4541a; }
    .empty { text-align: center; color: #6b6b75; padding: 24px; }
    footer { margin-top: 14px; color: #6b6b75; font-size: 8.5pt; }
  </style></head><body>
    <div class="course">${escape(exam.courseTitle)}</div>
    <h1>${escape(exam.title)}</h1>
    <p class="meta">${when(exam.opensAt)} → ${when(exam.closesAt)} · ${exam.questionCount} questions · ${exam.durationMin} min · Teacher: ${escape(exam.teacher.name)}</p>
    <div class="stats">
      <div class="stat"><b>${rows.length}</b><span>Submitted</span></div>
      <div class="stat"><b>${stat(average)}</b><span>Average</span></div>
      <div class="stat"><b>${stat(grades.length ? Math.max(...grades) : null)}</b><span>Highest</span></div>
      <div class="stat"><b>${stat(grades.length ? Math.min(...grades) : null)}</b><span>Lowest</span></div>
      <div class="stat"><b>${toGrade}</b><span>To grade</span></div>
    </div>
    <table>
      <thead><tr>
        <th class="num">#</th><th>Student</th><th>Status</th><th>Finished</th><th class="num">Points</th><th class="num">Grade</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    <footer>Grades out of ${scale}. Exported from Halaqa on ${when(new Date().toISOString())}.</footer>
  </body></html>`;
}
