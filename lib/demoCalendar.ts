// A sample calendar for trying the Meetings feature without sharing a real one. Dates are always in the coming days.

const ev = (now: Date, uidKey: string, dayOffset: number, hourIst: number, title: string, people: [string, string][]): string[] => {
  const d = new Date(now.getTime() + dayOffset * 86_400_000);
  // hourIst is India time; convert to UTC for the DTSTART
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hourIst - 6, 30, 0)); // IST is UTC+5:30, so 11:00 IST = 05:30 UTC
  const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VEVENT',
    `UID:demo-${uidKey}-${utc.toISOString().slice(0, 10)}@pitchprep`,
    `DTSTART:${fmt(utc)}`,
    `SUMMARY:${title}`,
    'ORGANIZER;CN=Priya Raghunathan:mailto:priya@sattvakitchen.in',
    ...people.map(([cn, mail]) => `ATTENDEE;CN="${cn}":mailto:${mail}`),
    'ATTENDEE;CN=Priya Raghunathan:mailto:priya@sattvakitchen.in',
    'END:VEVENT',
  ];
};

export function demoIcs(now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PitchPrep//Sample calendar//EN', 'X-WR-CALNAME:Sample calendar (Priya)',
    ...ev(now, 'forerunner', 1, 11, 'Intro call: Sattva Kitchen x Forerunner', [['Kirsten Green', 'kirsten@forerunnerventures.com']]),
    ...ev(now, 'blinkit', 1, 15, 'Blinkit category review', [['Aman Verma', 'aman.verma@blinkit.com']]),
    ...ev(now, 'candidate', 2, 12, 'Interview: Growth Manager candidate', [['Neha Rao', 'neha.rao@gmail.com']]),
    ...ev(now, 'peakxv', 3, 16, 'Coffee with Rajan (Peak XV)', [['Rajan Anandan', 'rajan@peakxv.com']]),
    ...ev(now, 'yc', 5, 10, 'Partner chat: Y Combinator', [['Garry Tan', 'garry@ycombinator.com']]),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
