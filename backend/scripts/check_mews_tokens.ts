import fetch from 'node-fetch';

const BASE = 'https://api.mews-demo.com';
const PATH = '/connector/v1/availability';
const url = `${BASE}${PATH}?propertyId=1&start=2025-12-05&end=2025-12-08&nights=3`;

const TOKENS = [
  'C66EF7B239D24632943D115EDE9CB810-EA00F8FD8294692C940F6B5A8F9453D',
  'CC150C355D6A4048A220AD20015483AB-B6D09C0C84B09538077CB8FFBB907B4',
  '5F56B9903A834F199E28AD20015E58CA-5C6A1A00550634911534AD6A098E8B7',
  '39E301DD5A1C4A569087AD20015F60DD-50DC28896E9090CCA0995C9BBD90351',
  '4D6C7ABE0E6A4681B0AFB16900AE5D86-DF50CBC89E1D4FF5859DDF021649ED5',
  '1AEFA58C55E74D65BDC7AD2001564C12-66633E0B736F523379B9E5966165A55',
  '682C235379B64D909941AD2001577525-BFC60A026081F1350FAA99CAB9F7510',
  'BFD4298010F54B069F3DAD20015D53EA-D5561FADFBA4EFC8EA4C179C6BC461F'
];

(async () => {
  for (let i = 0; i < TOKENS.length; i++) {
    const t = TOKENS[i];
    console.log(`=== Token #${i+1} ===`);
    try {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } });
      const text = await resp.text();
      console.log('HTTP', resp.status);
      console.log('Content-Type:', resp.headers.get('content-type'));
      console.log('Body (first 800 chars):', text.slice(0,800).replace(/\n/g,' '));
    } catch (err) {
      console.error('Request error:', err);
    }
    console.log('\n');
  }
})();
