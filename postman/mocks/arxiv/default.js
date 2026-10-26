// Local, synthetic fixtures. URL shapes follow arXiv's documented abs/pdf routes.
const http = require("node:http");

function syntheticPdf(pages = 1) {
  const lines = [
    "SYNTHETIC BODY ONLY - not an actual paper.",
    "This fixture verifies that the reader downloads the paper body.",
    "It contains no scientific claims or research results.",
    "Figures and tables have not been inspected by this text reader.",
  ];
  const stream = "BT /F1 12 Tf 40 700 Td " + lines.map((line) => `(${line}) Tj 0 -20 Td`).join(" ") + " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${pages} /Kids [${Array.from({ length: pages }, (_, i) => `${i + 6} 0 R`).join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Title (Synthetic reader fixture) >>",
    ...Array.from({ length: pages }, () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 4 0 R >>"),
  ];
  let text = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(text));
    text += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(text);
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  text += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return text;
}

http.createServer((req, res) => {
  const path = new URL(req.url, "http://mock.local").pathname;
  const send = (status, type, body) => {
    res.writeHead(status, { "Content-Type": type });
    res.end(body);
  };
  if (req.method !== "GET") return send(501, "text/plain", "Not modeled");
  if (path.startsWith("/abs/")) return send(200, "text/html",
    "<main><h1>Synthetic abstract</h1><p>" + "Abstract metadata only; no full paper body is present. ".repeat(5) + "</p></main>");
  if (path === "/pdf/2601.22222.pdf" || path === "/pdf/2601.33333.pdf") {
    res.writeHead(302, { Location: path.includes("33333") ? "http://127.0.0.1/private" : "https://arxiv.org/pdf/2601.12345v2" });
    return res.end();
  }
  if (path === "/pdf/2601.44444") return send(200, "text/html", "<main>" + "The document is temporarily unavailable. ".repeat(10) + "</main>");
  if (path === "/pdf/2601.55555.pdf") return send(404, "text/html", "No paper found");
  if (path === "/pdf/2601.66666") return send(200, "application/pdf", syntheticPdf(41));
  if (path === "/pdf/2601.77777") return send(200, "application/pdf", "%PDF-1.4\ninvalid synthetic PDF");
  if (["/pdf/2601.12345v2.pdf", "/pdf/2601.12345v2", "/pdf/hep-th/9901001v3.pdf"].includes(path))
    return send(200, "application/pdf", syntheticPdf());
  return send(501, "text/plain", "Path not modeled");
}).listen(process.env.PORT);
