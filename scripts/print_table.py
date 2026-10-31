import json

rows = json.load(open('data/research/provenance_table_data.json', encoding='utf-8'))
header = "| Unternehmen / Ereignis | Originalquelle nachgewiesen | Tatsächlich eingelesen | Testdaten ausgeschlossen | Ereignis belegt | Mandatsbedarf belegt | Ergebnis |"
sep = "|---|---|---|---|---|---|---|"
print(header)
print(sep)
for r in rows:
    comp = r['company']
    q = r['quelle_belegt']
    e = r['eingelesen']
    t = r['testdaten_ausgeschlossen']
    eb = r['ereignis_belegt']
    mb = r['mandatsbedarf_belegt']
    res = f"{r['ergebnis']}"
    if r['target_role'] and r['target_role'] != 'KEINE':
        res += f" ({r['target_role']})"
    print(f"| **{comp}**<br>_{r['title'][:60]}..._ | {q} | {e} | {t} | {eb} | {mb} | **{res}** |")
