import { ChevronDown } from "lucide-react";
import { MotionConfig, motion, type Transition } from "motion/react";
import { useState, type ReactNode } from "react";
import useMeasure from "react-use-measure";

import { cn } from "@/lib/utils";

// Split accordion — from the Watermelon UI registry
// (registry.watermelon.sh/r/card-split-accordion), retyped and rethemed.
//
// Two changes from the published component, both deliberate:
//   · its hardcoded zinc palette and demo copy are gone, replaced by DESIGN.md
//     roles, so it reads as part of this app rather than a pasted widget;
//   · `content` takes a ReactNode instead of a string, because what goes inside
//     here is a list of accounts with balances, not a paragraph.
//
// The mechanic that makes it worth importing: the open row detaches from the
// stack — its neighbours round away from it — so a drilled-into bucket reads as
// one card rather than a row that grew.

export type SplitAccordionItem = {
  id: string;
  title: ReactNode;
  /** Right-aligned in the header — the bucket total, in practice. */
  meta?: ReactNode;
  icon?: ReactNode;
  content: ReactNode;
};

const spring: Transition = { type: "spring", stiffness: 600, damping: 50, mass: 1 };

const RADIUS = 12; // DESIGN.md rounded.lg

function Row({
  item,
  index,
  total,
  openIndex,
  onToggle,
}: {
  item: SplitAccordionItem;
  index: number;
  total: number;
  openIndex: number;
  onToggle: (id: string | null) => void;
}) {
  const [ref, bounds] = useMeasure();

  const isOpen = index === openIndex;
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const isBeforeOpen = index === openIndex - 1;
  const isAfterOpen = index === openIndex + 1;
  // A neighbour that ends up on its own edge of the stack rounds fully, rather
  // than keeping a square corner against nothing.
  const isAlone = (isAfterOpen && isLast) || (isBeforeOpen && isFirst);

  // Rows share one hairline: only the outer edges of a run draw a border, so a
  // collapsed stack looks like a single grouped card.
  const border = "1px";
  const borderTopWidth = isFirst || isAfterOpen || isOpen ? border : "0px";
  const borderBottomWidth = isLast || isBeforeOpen || isOpen ? border : "0px";

  const round = { tl: 0, tr: 0, bl: 0, br: 0 };
  if (isOpen || isAlone) {
    round.tl = round.tr = round.bl = round.br = RADIUS;
  } else if (isBeforeOpen) {
    round.bl = round.br = RADIUS;
  } else if (isAfterOpen) {
    round.tl = round.tr = RADIUS;
  } else if (isFirst) {
    round.tl = round.tr = RADIUS;
  } else if (isLast) {
    round.bl = round.br = RADIUS;
  }

  const panelId = `split-panel-${item.id}`;

  return (
    <motion.li layout>
      <motion.div
        animate={{
          borderTopLeftRadius: round.tl,
          borderTopRightRadius: round.tr,
          borderBottomLeftRadius: round.bl,
          borderBottomRightRadius: round.br,
        }}
        className="border-outline bg-surface overflow-hidden border-solid will-change-transform"
        style={{
          borderTopWidth,
          borderBottomWidth,
          borderLeftWidth: border,
          borderRightWidth: border,
          marginBlock: isOpen ? "10px" : "0px",
        }}
      >
        <button
          type="button"
          onClick={() => onToggle(isOpen ? null : item.id)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left",
            "hover:bg-surface-pressed focus-visible:ring-focus-ring transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2",
          )}
        >
          {item.icon ? <span className="text-dim shrink-0">{item.icon}</span> : null}
          <span className="text-body-lg text-ink min-w-0 flex-1 truncate font-semibold">
            {item.title}
          </span>
          {item.meta ? <span className="shrink-0">{item.meta}</span> : null}
          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="shrink-0">
            <ChevronDown className="text-chevron size-4" />
          </motion.span>
        </button>

        <motion.div
          id={panelId}
          initial={false}
          animate={{ height: isOpen ? bounds.height : 0, opacity: isOpen ? 1 : 0 }}
          className="overflow-hidden will-change-transform"
          aria-hidden={!isOpen}
        >
          <div ref={ref}>
            <div className="px-4 pb-4">{item.content}</div>
          </div>
        </motion.div>
      </motion.div>
    </motion.li>
  );
}

export function CardSplitAccordion({
  items,
  className,
}: {
  items: SplitAccordionItem[];
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openIndex = items.findIndex((i) => i.id === openId);

  return (
    <MotionConfig transition={spring} reducedMotion="user">
      <ul className={cn("w-full", className)}>
        {items.map((item, index) => (
          <Row
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            openIndex={openIndex}
            onToggle={setOpenId}
          />
        ))}
      </ul>
    </MotionConfig>
  );
}
