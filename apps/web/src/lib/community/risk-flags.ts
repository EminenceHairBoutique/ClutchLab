/**
 * Automated risk flags (spec §5.16): rule-based screening for prohibited
 * content categories. Matches FLAG for human review — they never auto-remove,
 * and moderators make the final call. Deliberately conservative patterns.
 */

interface RiskRule {
  reason: string;
  pattern: RegExp;
}

const RULES: RiskRule[] = [
  { reason: "possible cheat/hack promotion", pattern: /\b(aim\s?bot|wall\s?hack|esp\s+hack|no\s?recoil\s+(hack|mod|apk)|cheat\s+(menu|apk|download))\b/i },
  { reason: "possible macro/script promotion", pattern: /\b(macro|auto[-\s]?clicker|recoil\s+script|scripting\s+tool)\b/i },
  { reason: "possible modified client", pattern: /\b(mod(ded)?\s+apk|injector|config\s+file\s+(hack|exploit))\b/i },
  { reason: "possible account trading", pattern: /\b(sell(ing)?|buy(ing)?)\s+(my\s+)?accounts?\b/i },
  { reason: "possible UC scam", pattern: /\buc\b.{0,40}\b(cheap|discount|free|sale|top[-\s]?up\s+deal)\b/i },
  { reason: "possible credential phishing", pattern: /\b(send|share|give)\b.{0,30}\b(password|login|credentials)\b/i },
  { reason: "unverified verification claim", pattern: /\bofficial(ly)?\s+verified\b/i },
];

export interface RiskCheck {
  flagged: boolean;
  reason: string | null;
}

export function checkContentRisk(text: string): RiskCheck {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { flagged: true, reason: rule.reason };
    }
  }
  return { flagged: false, reason: null };
}
