// Reading shared documents: PDF / Word / Excel / PowerPoint text extraction and answers about them. Fixtures are built on the fly.
const H = require('./server-setup.cjs'); const { ok } = H;
const { spawnSync } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
global.fetch = async () => { throw new Error('offline'); };
const D = H.req('lib/docText'); const FI = H.req('utils/chatEngine/fileInsights'); const E = H.req('utils/chatEngine/index');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-'));
const py = `
import zipfile, zlib, sys
d=sys.argv[1]
def z(name, files):
    with zipfile.ZipFile(d+'/'+name,'w',zipfile.ZIP_DEFLATED) as f:
        for k,v in files.items(): f.writestr(k,v)
W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
z('a.docx',{'word/document.xml':f'<w:document {W}><w:body><w:p><w:r><w:t>Quarterly Report</w:t></w:r></w:p><w:p><w:r><w:t>The delivery deadline is 14 March and the total budget is UGX 5,000,000 &amp; fees.</w:t></w:r></w:p><w:p><w:r><w:t>Warranty lasts twelve months after handover.</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cost</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'})
z('b.xlsx',{'xl/workbook.xml':'<workbook><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/sharedStrings.xml':'<sst><si><t>Product</t></si><si><t>Screen</t></si><si><t>Battery</t></si></sst>','xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Price</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>120000</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="C3"><v>45000</v></c></row></sheetData></worksheet>'})
z('c.pptx',{'ppt/slides/slide2.xml':'<p:sld><a:p><a:r><a:t>Second slide pricing</a:t></a:r></a:p></p:sld>','ppt/slides/slide1.xml':'<p:sld><a:p><a:r><a:t>Welcome to the launch</a:t></a:r></a:p></p:sld>'})
content=b'BT /F1 12 Tf 72 700 Td (Invoice number 4471 is due on Friday.) Tj 0 -14 Td [(Thanks for your ) -300 (business)] TJ ET'
comp=zlib.compress(content)
pdf=b'%PDF-1.4\\n1 0 obj\\n<< /Type /Page >>\\nendobj\\n2 0 obj\\n<< /Filter /FlateDecode /Length '+str(len(comp)).encode()+b' >>\\nstream\\n'+comp+b'\\nendstream\\nendobj\\n3 0 obj\\n<< /Length '+str(len(content)).encode()+b' >>\\nstream\\n'+content+b'\\nendstream\\nendobj\\ntrailer\\n%%EOF'
open(d+'/d.pdf','wb').write(pdf)
open(d+'/bomb.docx','wb').write(b'PK\\x03\\x04'+b'\\x00'*50)
`;
const r = spawnSync('python3', ['-c', py, dir]); if (r.status) { console.error(String(r.stderr)); process.exit(1); }
const bytes = (n) => new Uint8Array(fs.readFileSync(path.join(dir, n)));
const mem = () => ({ interactionCount: 0, lastTopic: 'general', userContext: {}, conversationHistory: [] });
(async () => {
  let t = await D.extractDocText(bytes('a.docx'), 'docx');
  ok('docx text + entities', /Quarterly Report/.test(t.text) && /UGX 5,000,000 & fees/.test(t.text) && /Item \| Cost/.test(t.text), t.text.slice(0, 120));
  t = await D.extractDocText(bytes('b.xlsx'), 'xlsx');
  ok('xlsx sheet, shared + inline strings, gaps', /Sheet: Sales/.test(t.text) && /Product\tPrice/.test(t.text) && /Screen\t120000/.test(t.text) && /Battery\t\t45000/.test(t.text), JSON.stringify(t.text));
  t = await D.extractDocText(bytes('c.pptx'), 'pptx');
  ok('pptx slides in numeric order', t.text.indexOf('Welcome') < t.text.indexOf('Second') && t.pages === 2, t.text);
  t = await D.extractDocText(bytes('d.pdf'), 'pdf');
  ok('pdf flate text (Tj and TJ)', /Invoice number 4471 is due on Friday\./.test(t.text) && /Thanks for your business/.test(t.text), JSON.stringify(t));
  t = await D.extractDocText(bytes('bomb.docx'), 'docx');
  ok('corrupt office file is handled, not thrown', t.text === '' && !!t.note);
  t = await D.extractDocText(new Uint8Array([1, 2, 3]), 'pdf');
  ok('garbage pdf is handled', t.text === '' && !!t.note);

  const mk = (n, ext, mime) => { const b = fs.readFileSync(path.join(dir, n)); return new File([b], n, { type: mime }); };
  const ins = await FI.analyzeFile(mk('a.docx', 'docx'));
  ok('analyzeFile gives a doc insight with text', ins.kind === 'doc' && /Word document/.test(ins.summary) && /deadline/.test(ins.text), ins.summary);
  ok('doc is rejected if not a zip', await FI.analyzeFile(new File([new Uint8Array([65, 66, 67, 68])], 'x.docx')).then(() => false, () => true));
  const pdf = await FI.analyzeFile(mk('d.pdf', 'pdf'));
  ok('pdf insight has pages and text', pdf.kind === 'pdf' && /1 page/.test(pdf.summary) && /Invoice/.test(pdf.text), pdf.summary);

  const ask = async (files, q, opts = {}) => E.processChatQuery(q, 'FRIENDLY', mem(), { files, ...opts });
  let a = await ask([ins], 'when is the deadline in this document?');
  ok('answers a question from the docx', /14 March/.test(a.reply), a.reply.slice(0, 160));
  a = await ask([ins], 'summarize it');
  ok('summarises the docx with quoted points', /Quarterly Report|deadline/.test(a.reply) && /main points/.test(a.reply), a.reply.slice(0, 160));
  a = await ask([ins], 'what does the document say about parking permits?');
  ok('says honestly when the file does not mention it', /didn.t find anything/.test(a.reply), a.reply.slice(0, 160));
  a = await ask([pdf], 'what is the invoice number?');
  ok('answers from the pdf', /4471/.test(a.reply), a.reply.slice(0, 160));
  a = await ask([ins], 'what is the capital of france');
  ok('unrelated question is not hijacked by a shared file', /Paris/.test(a.reply), a.reply.slice(0, 100));
  a = await ask([ins], 'how much for a logo');

  // ---- help accordingly: diagnose, money, brief, list, spreadsheet questions
  const txt = (name, body) => FI.analyzeFile(new File([body], name));
  const logf = await txt('crash.log', '2026-11-20 10:01:02 INFO boot\n2026-11-20 10:01:09 ERROR KERNEL_DATA_INPAGE_ERROR stop code 0x7A\n2026-11-20 10:02:00 WARN disk read error on C:\n');
  a = await ask([logf], 'any errors?');
  ok('log diagnosis names the failure', /Drive or boot failure|Windows blue-screen/.test(a.reply), a.reply.slice(0, 200));
  a = await ask([logf], 'how do i fix this?');
  ok('log fix advice', /Try:/.test(a.reply) && /drive|back up/i.test(a.reply), a.reply.slice(0, 200));
  a = await ask([logf], 'here is my file', { filesAreNew: true });
  ok('first reply for an error log includes diagnosis and next step', /What I can see in the errors/.test(a.reply) && /What I'd do next/.test(a.reply), a.reply.slice(0, 200));
  const inv = await txt('inv.txt', 'INVOICE No: INV-2041\nDate: 3 November 2026\nScreen replacement  UGX 120,000\nLabour  UGX 30,000\nTotal: UGX 150,000\nDue date: 10 November 2026\n');
  a = await ask([inv], 'what is the total?');
  ok('invoice total', /150,000/.test(a.reply), a.reply.slice(0, 160));
  a = await ask([inv], 'when is it due?');
  ok('invoice due date', /10 November 2026/.test(a.reply), a.reply.slice(0, 160));
  a = await ask([inv], 'what is the invoice number?');
  ok('invoice reference', /INV-2041/.test(a.reply), a.reply.slice(0, 160));
  const brief = await txt('brief.txt', 'Project brief: we need a new logo and brand colours, a website with 5 pages and these features. Budget UGX 2,000,000. Deadline in March. Deliverables: design files.');
  a = await ask([brief], 'here is my file', { filesAreNew: true });
  ok('brief is recognised and offered to the owner', /project brief/.test(a.reply) && /owner/.test(a.reply), a.reply.slice(0, 200));
  a = await ask([ins, logf], 'what files do i have?');
  ok('lists files', /crash\.log/.test(a.reply) && /a\.docx/.test(a.reply), a.reply.slice(0, 200));
  a = await ask([], 'what files do i have?');
  ok('no files message', /No files/.test(a.reply) || a.source !== 'system', a.reply.slice(0, 100));
  const xl = await FI.analyzeFile(mk('b.xlsx', 'xlsx'));
  a = await ask([xl], 'how many rows are in the file?');
  ok('questions about an xlsx are answered as a table', /\b2\b/.test(a.reply), a.reply.slice(0, 200));
  ok('quick asks adapt to the file', FI.quickAsks(logf).some((x) => /fix/i.test(x)) && FI.quickAsks(inv).some((x) => /total/i.test(x)));
  ok('business question still answered with a file present', !/From \*\*a\.docx/.test(a.reply), a.reply.slice(0, 100));
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
