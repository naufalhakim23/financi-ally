package reporting

import (
	"testing"
	"time"
)

// Month arithmetic is the part of MonthlySeries that can silently drift (year
// rollover, 31-day months, DST zones), so it is tested without a database.
func TestMonthWindows(t *testing.T) {
	// A day-31 timestamp in a non-UTC zone: AddDate on a non-normalized date is
	// exactly where month math goes wrong.
	now := time.Date(2026, time.March, 31, 23, 30, 0, 0, time.FixedZone("WIB", 7*3600))
	got := monthWindows(now, 4)

	if len(got) != 4 {
		t.Fatalf("want 4 windows, got %d", len(got))
	}
	want := []string{"2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01"}
	for i, w := range want {
		if s := got[i].start.Format("2006-01-02"); s != w {
			t.Errorf("window %d start = %s, want %s", i, s, w)
		}
		if got[i].start.Location() != time.UTC {
			t.Errorf("window %d start not UTC: %v", i, got[i].start.Location())
		}
	}
	// Windows must be contiguous and half-open: each end is the next start.
	for i := 0; i < len(got)-1; i++ {
		if !got[i].end.Equal(got[i+1].start) {
			t.Errorf("window %d end %v != window %d start %v", i, got[i].end, i+1, got[i+1].start)
		}
	}
	if last := got[3].end.Format("2006-01-02"); last != "2026-04-01" {
		t.Errorf("last end = %s, want 2026-04-01", last)
	}
}
