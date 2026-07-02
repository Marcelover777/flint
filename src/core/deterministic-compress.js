const { protectSegments, restoreSegments } = require('./protect');

const RULES = [
  // Multi-word phrase rewrites first so shorter filler rules cannot break them.
  ['due_to_fact', /\bdue to the fact that\b/gi, 'because'],
  ['despite_fact', /\b(?:despite|in spite of) the fact that\b/gi, 'although'],
  ['the_fact_that', /\bthe fact that\b/gi, 'that'],
  ['in_the_event', /\bin the event that\b/gi, 'if'],
  ['point_in_time', /\bat this point in time\b/gi, 'now'],
  // "at the moment of ..." must not become "now of ..." — context guard.
  ['at_the_moment', /\bat the moment\b(?! of)/gi, 'now'],
  ['in_order_to', /\bin order to\b/gi, 'to'],
  ['in_order_for', /\bin order for\b/gi, 'for'],
  ['prior_to', /\bprior to\b/gi, 'before'],
  ['subsequent_to', /\bsubsequent to\b/gi, 'after'],
  ['is_able_to', /\b(?:is|are) able to\b/gi, 'can'],
  ['will_be_able_to', /\bwill be able to\b/gi, 'can'],
  ['whether_or_not', /\bwhether or not\b/gi, 'whether'],
  ['each_and_every', /\beach and every\b/gi, 'every'],
  ['a_large_number_of', /\ba large number of\b/gi, 'many'],
  ['the_majority_of', /\bthe majority of\b/gi, 'most'],
  ['on_a_regular_basis', /\bon a regular basis\b/gi, 'regularly'],
  // NOTE: "as well as" is intentionally NOT rewritten — in comparisons
  // ("works as well as the old one") it is not a conjunction, and the two
  // senses cannot be told apart deterministically.
  ['in_conjunction_with', /\bin conjunction with\b/gi, 'with'],
  ['with_regard_to', /\bwith regards? to\b/gi, 'about'],
  ['take_into_account', /\btake into account\b/gi, 'consider'],
  ['in_most_cases', /\bin most cases,?\s*(?!of\b)/gi, 'usually '],
  // "as a result of X" must not become "so of X" — context guard.
  ['as_a_result', /\bas a result(?! of)\b,?\s*/gi, 'so '],
  ['however_comma', /\bhowever,\s*/gi, 'but '],
  ['therefore', /\btherefore,?\s*/gi, 'so '],
  ['in_addition_comma', /\bin addition,\s*/gi, 'also, '],
  ['important_note', /\bit (?:is|should be) (?:important to |)(?:noted?|remember(?:ed)?|mention(?:ed)?) that\s*/gi, ''],
  ['worth_noting', /\bit(?:'s| is) worth noting that\s*/gi, ''],
  ['note_that', /\b(?:note that|keep in mind that|remember that|be aware that)\s+/gi, ''],
  ['in_other_words', /\bin other words,?\s*/gi, ''],
  ['going_forward', /,?\s*going forward\b/gi, ''],
  ['utilize', /\butili[sz](e[sd]?|ing)\b/gi, (m, tail) => ({ e: 'use', es: 'uses', ed: 'used', ing: 'using' })[tail.toLowerCase()] || 'use'],
  // Extended flint rules — high-frequency, meaning-preserving rewrites.
  ['for_the_purpose_of', /\bfor the purpose of\b/gi, 'for'],
  ['with_the_exception_of', /\bwith the exception of\b/gi, 'except'],
  ['in_the_context_of', /\bin the context of\b/gi, 'in'],
  ['in_terms_of', /\bin terms of\b/gi, 'for'],
  // "range" removed: "accepts a range of 0-100" must not become "accepts several 0-100".
  ['a_number_of', /\ba (?:number|variety) of\b/gi, 'several'],
  ['has_ability_to', /\b(?:has|have) the ability to\b/gi, 'can'],
  ['has_option_to', /\b(?:has|have) the option to\b/gi, 'can'],
  ['is_going_to', /\b(is|are) going to\b/gi, 'will'],
  ['there_is_a_need_to', /\bthere is a need to\b/gi, 'must'],
  ['it_is_possible_to', /\bit is possible to\b/gi, 'you can'],
  ['it_is_necessary_to', /\bit is necessary to\b/gi, 'must'],
  ['take_a_look', /\btake a look at\b/gi, 'see'],
  ['at_time_of_writing', /\bat the time of writing,?\s*/gi, 'currently '],
  ['in_a_timely_manner', /\bin a timely manner\b/gi, 'promptly'],
  ['at_all_times', /\bat all times\b/gi, 'always'],
  ['in_the_near_future', /\bin the near future\b/gi, 'soon'],
  ['is_located_in', /\b(is|are) located (in|at|on)\b/gi, (m, v, prep) => `${v.toLowerCase() === 'are' ? 'are' : 'is'} ${prep.toLowerCase()}`],
  ['for_example', /\bfor example,?\s*/gi, 'e.g. '],
  ['that_is_comma', /\bthat is,\s*/gi, 'i.e. '],
  ['approximately', /\bapproximately\b/gi, '~'],
  ['versus', /\bversus\b/gi, 'vs'],
  ['in_case_of', /\bin the case of\b/gi, 'for'],
  ['first_of_all', /\bfirst of all,?\s*/gi, 'first, '],
  ['needless_to_say', /\bneedless to say,?\s*/gi, ''],
  ['as_mentioned', /\bas (?:previously )?mentioned(?: above| before| earlier)?,?\s*/gi, ''],
  ['please_note', /\bplease note[:,]?\s*/gi, ''],
  // Contractions — mechanical, meaning-exact, frequent in prose docs.
  // Clause-final "it is"/"that is" ("as it is.") must NOT contract — English
  // forbids contracted forms at clause end, so require a following word.
  ['ctr_do_not', /\bdo not\b/g, "don't"],
  ['ctr_does_not', /\bdoes not\b/g, "doesn't"],
  ['ctr_did_not', /\bdid not\b/g, "didn't"],
  ['ctr_cannot', /\bcannot\b/g, "can't"],
  ['ctr_will_not', /\bwill not\b/g, "won't"],
  ['ctr_should_not', /\bshould not\b/g, "shouldn't"],
  ['ctr_is_not', /\bis not\b/g, "isn't"],
  ['ctr_are_not', /\bare not\b/g, "aren't"],
  ['ctr_it_is', /\bit is\b(?=\s+\w)/g, "it's"],
  ['ctr_that_is', /\bthat is\b(?!,)(?=\s+\w)/g, "that's"],
  // Portuguese (PT-BR) phrase rewrites — same flint intent, same safety bar.
  ['pt_devido_fato', /\bdevido ao fato de que\b/gi, 'porque'],
  ['pt_apesar_fato', /\bapesar do fato de que\b/gi, 'embora'],
  ['pt_a_fim_de', /\ba fim de\b/gi, 'para'],
  ['pt_neste_momento', /\bneste momento\b/gi, 'agora'],
  // \b cannot anchor before the non-ASCII "É", so anchor on start/whitespace.
  ['pt_importante_notar', /(^|[\s(;:,.!?])[eé] importante (?:notar|destacar|ressaltar|lembrar) que,?\s*/gim, (m, g1) => g1],
  ['pt_vale_mencionar', /\bvale (?:a pena )?(?:mencionar|notar|destacar) que\s*/gi, ''],
  ['pt_tenha_em_mente', /\btenha em mente que\s*/gi, ''],
  ['pt_certifique', /\bcertifique-se de\b/gi, 'garanta'],
  ['pt_no_entanto', /\bno entanto,?\s*/gi, 'mas '],
  ['pt_alem_disso', /\bal[eé]m disso,?\s*/gi, 'e '],
  ['pt_fillers', /\b(?:basicamente|simplesmente|literalmente|essencialmente|na verdade|de fato)\b,?\s*/gi, ''],
  ['pt_pleasantries', /\b(?:por favor|obrigad[oa]|com certeza)\b[,.]?\s*/gi, ''],
  // Extended PT-BR rules — same safety bar as the EN set.
  ['pt_com_objetivo_de', /\bcom (?:o (?:objetivo|intuito|prop[oó]sito)|a (?:finalidade|inten[cç][aã]o)) de\b/gi, 'para'],
  ['pt_atraves_de', /\b(?:atrav[eé]s de|por meio de|por interm[eé]dio de)\b/gi, 'via'],
  ['pt_dessa_forma', /\b(?:dessa|desta) (?:forma|maneira),?\s*/gi, 'assim '],
  ['pt_ou_seja', /\bou seja,\s*/gi, 'i.e. '],
  ['pt_isto_e', /\bisto [eé],\s*/gi, 'i.e. '],
  ['pt_por_exemplo', /\bpor exemplo,?\s*/gi, 'ex. '],
  ['pt_grande_quantidade', /\buma grande quantidade de\b/gi, 'muitos'],
  ['pt_maioria_casos', /\bna maioria dos casos,?\s*/gi, 'geralmente '],
  ['pt_no_que_diz', /\bno que diz respeito a\b/gi, 'sobre'],
  ['pt_em_relacao_a', /\bem rela[cç][aã]o a\b/gi, 'sobre'],
  ['pt_tem_capacidade', /\btem a capacidade de\b/gi, 'pode'],
  ['pt_levar_em_conta', /\blevar em (?:considera[cç][aã]o|conta)\b/gi, 'considerar'],
  ['pt_no_momento_em_que', /\bno momento em que\b/gi, 'quando'],
  // \b cannot anchor before non-ASCII "é" — anchor on start/whitespace like
  // pt_importante_notar above. "é necessário que" must NOT become "precisa
  // que" (ungrammatical) — require a non-"que" continuation.
  ['pt_e_necessario', /(^|[\s(;:,])[eé] necess[aá]rio\b(?! que)/gim, (m, g1) => g1 + 'precisa'],
  ['pt_utilizar', /\butiliza(r|ndo|do|da|dos|das|m|)\b/gi, (m, tail) => 'usa' + tail.toLowerCase()],
  ['pt_aproximadamente', /\baproximadamente\b/gi, '~'],
  ['pt_conforme_mencionado', /\bconforme (?:mencionado|dito|citado)(?: acima| antes| anteriormente)?,?\s*/gi, ''],
  ['pt_vale_lembrar', /\bvale lembrar que\s*/gi, ''],
  ['pt_antes_de_mais_nada', /\bantes de mais nada,?\s*/gi, ''],
  // Single-word/short filler removals last.
  // "generally" is NOT removed: it scopes a claim ("generally safe" != "safe").
  // Hyphen guards keep compounds intact ("just-in-time", "very-high-level").
  // "sure" is only a pleasantry standalone — "make sure"/"be sure"/"not sure"
  // are semantic and must survive.
  ['pleasantries', /\b(?:certainly|of course|happy to|please|kindly|thank you|thanks)\b[,.!]?\s*/gi, ''],
  ['sure_standalone', /(?<!\bmake )(?<!\bmaking )(?<!\bbe )(?<!\bnot )\bsure\b[,.!]?\s*/gi, ''],
  ['fillers', /(?<!-)\b(?:just|really|basically|actually|simply|essentially|literally|very|quite)\b(?!-)\s*/gi, ''],
  // Only conversational hedges are removed. Modal verbs (might/may/could,
  // perhaps/maybe) and perception verbs ("it seems", "it appears") encode
  // uncertainty in technical claims — deleting them turns "seems corrupted"
  // into "corrupted", which is fact loss, not compression.
  ['hedges', /\b(?:i think|in my opinion|it may be worth)\b\s*/gi, ''],
  ['modal_potentially', /\b(could|may|might) potentially\b/gi, (m, g1) => g1],
  // "you can X" stays: it marks X as optional; stripping it makes X imperative.
  ['leaders', /^(?:i'?ll|i will|i can|i'?d|we will|we can|let me|let'?s|i recommend that)\s+/gim, ''],
];

// Article dropping (full/ultra only). "a few"/"a little"/"a lot"/"a bit" are
// quantifiers, not articles — "a few errors" -> "few errors" inverts meaning.
const ARTICLES = ['articles', /\b(?:a|an|the)\s+(?!(?:few|little|lot|bit)\b)(?=[a-z])/gi, ''];

// Abbreviations that legitimately end with "." mid-sentence — the sentence
// recapitalizer must not fire after them ("e.g. see docs" stays lowercase).
const NON_TERMINAL_DOT = /(?:\b(?:e\.g|i\.e|etc|vs|ex|approx|p\.ex|cf)\.|\.\.)$/i;

function applyRule(text, [rule, regex, replacement]) {
  let count = 0;
  const out = text.replace(regex, (...args) => {
    count++;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  return { out, count, rule };
}

function compressMasked(text, opts = {}) {
  const mode = opts.mode || 'full';
  const rules = mode === 'lite' ? RULES : [...RULES, ARTICLES];
  const rulesApplied = [];
  let out = String(text || '');
  for (const rule of rules) {
    const result = applyRule(out, rule);
    out = result.out;
    if (result.count) rulesApplied.push({ rule: result.rule, count: result.count });
  }
  out = out
    .replace(/[ \t]{2,}/g, ' ')
    // Same-line only: gluing across newlines destroys markdown structure
    // (an image/list line pulled onto the previous paragraph).
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    // Sentence recapitalization: same line only, and never after non-terminal
    // dots like "e.g." / "i.e." / "etc.".
    .replace(/(^|[.!?][ \t]+)([a-z])/gm, (whole, pre, ch, offset, str) => {
      if (pre) {
        const before = str.slice(0, offset + 1); // up to and including the punctuation
        if (NON_TERMINAL_DOT.test(before.slice(-8))) return whole;
      }
      return pre + ch.toUpperCase();
    });
  if (out !== text) rulesApplied.push({ rule: 'whitespace', count: 1 });
  return { compressed: out.trim(), rulesApplied };
}

function compressDeterministic(text, opts = {}) {
  const source = String(text || '');
  if (!source) return { compressed: source, beforeChars: 0, afterChars: 0, rulesApplied: [] };

  const shouldProtect = opts.protect !== false;
  const protectedResult = shouldProtect ? protectSegments(source, opts.protectOptions) : { text: source, segments: [] };
  const compressedMasked = compressMasked(protectedResult.text, opts);
  const restored = shouldProtect
    ? restoreSegments(compressedMasked.compressed, protectedResult.segments)
    : compressedMasked.compressed;

  return {
    compressed: restored,
    beforeChars: source.length,
    afterChars: restored.length,
    rulesApplied: compressedMasked.rulesApplied,
    protectedCount: protectedResult.segments.length,
  };
}

module.exports = {
  RULES,
  compressMasked,
  compressDeterministic,
};
