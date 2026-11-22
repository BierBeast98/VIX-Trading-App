export function purchaseFields(text: string) {
  const number = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)';
  function amount(label: string) {
    const match = text.match(new RegExp('(?:' + label + ')\\s*[:·]?\\s*(?:EUR|€)?\\s*' + number + '(?![.\\d,])', 'iu'));
    return match ? Number(match[1].replaceAll('.', '').replace(',', '.')) : undefined;
  }
  const isin = text.match(/\b[A-Z]{2}[A-Z0-9]{9}\d\b/)?.[0];
  const pieces = amount('Stückzahl|Stück|Anzahl|Menge') ?? Number(text.match(/\b(\d+)\s*(?:Stück|Stk\.)/iu)?.[1]);
  const price = amount('Ausführungskurs|Kaufkurs|Preis pro Stück|Stückpreis|Kurs');
  const fees = amount('Gesamtgebühren|Gebühren gesamt|Gebühren');
  return { ...(isin && { isin }), ...(Number.isSafeInteger(pieces) && pieces > 0 && { quantity: pieces }),
    ...(price != null && price > 0 && { price }), ...(fees != null && { fees }) };
}
