import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const extractPdfText = async (file) => {
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
  }).promise;

  let fullText = "";

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);

    const textContent = await page.getTextContent();

    // Sort text from top-to-bottom, then left-to-right
    const items = [...textContent.items].sort((a, b) => {
      const ay = a.transform[5];
      const by = b.transform[5];

      if (Math.abs(ay - by) > 2) {
        return by - ay;
      }

      return a.transform[4] - b.transform[4];
    });

    let lastY = null;

    for (const item of items) {
      const text = item.str?.trim();

      if (!text) continue;

      const currentY = item.transform[5];

      if (lastY !== null && Math.abs(lastY - currentY) > 2) {
        fullText += "\n";
      }

      fullText += text + " ";

      lastY = currentY;
    }

    fullText += "\n\n";
  }

  return fullText
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};