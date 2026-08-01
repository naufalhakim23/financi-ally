import { Model } from "@nozbe/watermelondb";
import { date, field, text } from "@nozbe/watermelondb/decorators";

export type AccountType = "asset" | "liability" | "income" | "expense" | "equity";

// WatermelonDB model classes. Fields hold only the app columns; relations are
// resolved at query time (screens query journal_lines by entry_id / account_id)
// rather than declared, to keep the model layer thin.
export class Account extends Model {
  static table = "accounts";
  @field("type") type!: string;
  @field("currency") currency!: string;
  @text("name") name!: string;
  @field("parent_id") parentId!: string | null;
  @field("archived") archived!: boolean;
}

export class Entry extends Model {
  static table = "entries";
  @date("txn_date") txnDate!: Date;
  @field("status") status!: string;
  @field("currency") currency!: string;
  /** Cross-currency rate as a decimal string; null on single-currency entries. */
  @field("fx_rate") fxRate!: string | null;
  @field("source") source!: string;
  @text("memo") memo!: string;
}

export class JournalLine extends Model {
  static table = "journal_lines";
  @field("entry_id") entryId!: string;
  @field("account_id") accountId!: string;
  @field("dc") dc!: "debit" | "credit";
  @field("amount_minor") amountMinor!: number;
  @field("currency") currency!: string;
}

export class Budget extends Model {
  static table = "budgets";
  @field("account_id") accountId!: string;
  @date("period_month") periodMonth!: Date;
  @field("target_minor") targetMinor!: number;
  @field("currency") currency!: string;
}

// The entry skeleton a recurring rule materializes on each occurrence. Stored
// as a JSON string because WatermelonDB columns are scalars.
export type RecurringTemplate = {
  currency: string;
  memo?: string;
  source?: string;
  lines: { account_id: string; dc: "debit" | "credit"; amount_minor: number; currency?: string }[];
};

export class RecurringRule extends Model {
  static table = "recurring_rules";
  @field("rrule") rrule!: string;
  @field("template") templateJson!: string;
  @date("next_run") nextRun!: Date | null;
  @date("last_run") lastRun!: Date | null;
  @field("active") active!: boolean;

  // The server is the only writer of a valid template, but a rule authored
  // offline is parsed here too — a malformed one must not crash the list.
  get template(): RecurringTemplate | null {
    try {
      return JSON.parse(this.templateJson) as RecurringTemplate;
    } catch {
      return null;
    }
  }
}
