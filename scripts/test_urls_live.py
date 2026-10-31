import urllib.request

urls = [
    'https://www.anleihen-finder.de/pferdewetten-de-ag-frank-hartmann-wird-neuer-cfo-00074184.html',
    'https://www.anleihen-finder.de/photon-energy-group-andrej-horansky-ist-neuer-cfo-00074067.html',
    'https://www.anleihen-finder.de/deag-markus-breitenecker-wird-zum-01-november-2026-neuer-ceo-00073962.html',
    'https://amtsblattportal.ch/api/v1/publications/af1d02e1-761e-4ecf-a03a-6a34bc1d7799/pdf'
]

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

for u in urls:
    try:
        req = urllib.request.Request(u, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = resp.read()
            print(f'URL: {u}')
            print(f'Status: {resp.status} | Length: {len(data)} bytes')
            text = data.decode('utf-8', errors='ignore')
            clean = ' '.join(text[:300].split())
            print(f'Snippet: {clean}')
            print('-'*60)
    except Exception as e:
        print(f'URL: {u} -> ERROR: {e}')
