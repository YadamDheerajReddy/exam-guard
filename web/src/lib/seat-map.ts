// Halls have no stored physical layout (supabase/migrations: just
// building_name/room_number/floor_level/capacity) and admins type
// seat_number as free text, so this can only ever be a schematic guess —
// never the hall's real layout. That's why every caller of this is
// required to label the result BETA and disclaim it against the
// invigilator's in-person seat check.
//
// Parsing: "<row letters><seat number>" (A1, B12, AA3, ...). Anything that
// doesn't match that shape is reported unavailable rather than guessed at.
export type SeatMapResult =
  | {
      kind: "grid";
      cols: number;
      totalRows: number;
      seatRow: number;
      seatCol: number;
      windowStart: number;
      windowEnd: number;
      rowLabel: (row: number) => string;
    }
  | { kind: "unavailable" };

const ROW_WIDTH = 8;
const ROW_WINDOW = 2;
// Real classroom rows are "A"–"Z" or occasionally "AA"–"ZZ", never longer —
// anything past 2 letters (e.g. seat_number "Table3") is not a row label at
// all, and running it through the base-26 conversion below would produce a
// nonsense row index in the millions.
const MAX_ROW_LETTERS = 2;
// A seat number's trailing digits are read as "position within the row" —
// fine for realistic values (A1..A40), but a free-text id like "S-104"
// parses as row "S", seat 104, which would render a single row 104 seats
// wide. Past this width it's more honest to say the layout isn't available
// than to draw something that wide.
const MAX_SEATS_PER_ROW = 40;

function lettersToRowIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function rowIndexToLetters(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function computeSeatMap(seatNumber: string, capacity: number): SeatMapResult {
  const trimmed = seatNumber.trim();
  const match = trimmed.match(/^([A-Za-z]*)\s*-?\s*0*(\d+)$/);
  if (!match) return { kind: "unavailable" };

  const [, letters, digits] = match;
  const seatInRow = parseInt(digits, 10);
  if (!Number.isFinite(seatInRow) || seatInRow < 1) return { kind: "unavailable" };
  if (!Number.isFinite(capacity) || capacity < 1) return { kind: "unavailable" };
  if (letters.length > MAX_ROW_LETTERS) return { kind: "unavailable" };
  if (letters && seatInRow > MAX_SEATS_PER_ROW) return { kind: "unavailable" };

  let cols: number;
  let seatRow: number;
  let seatCol: number;
  let rowLabel: (row: number) => string;

  if (letters) {
    seatRow = lettersToRowIndex(letters);
    seatCol = seatInRow - 1;
    cols = Math.max(seatCol + 1, ROW_WIDTH);
    rowLabel = rowIndexToLetters;
  } else {
    cols = Math.min(ROW_WIDTH, Math.max(capacity, 1));
    const idx0 = seatInRow - 1;
    seatRow = Math.floor(idx0 / cols);
    seatCol = idx0 % cols;
    rowLabel = (row) => String(row + 1);
  }

  const totalRows = Math.max(seatRow + 1, Math.ceil(capacity / cols));
  const windowStart = Math.max(0, seatRow - ROW_WINDOW);
  const windowEnd = Math.min(totalRows - 1, seatRow + ROW_WINDOW);

  return { kind: "grid", cols, totalRows, seatRow, seatCol, windowStart, windowEnd, rowLabel };
}
