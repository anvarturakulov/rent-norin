import { useCallback } from "react";
import { PDF_CONFIG, PDF_ERROR_MESSAGES, PDF_FILENAME_TEMPLATE } from "../constants/pdf.config";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import axios from "axios";

// Хук для работы с PDF
export const usePDFGenerator = () => {
    const generatePDF = useCallback(async (reportRef: React.RefObject<HTMLDivElement>) => {
      if (!reportRef.current) {
        throw new Error(PDF_ERROR_MESSAGES.CONTENT_NOT_FOUND);
      }
  
      const canvas = await html2canvas(reportRef.current, {
        scale: PDF_CONFIG.SCALE,
        useCORS: true,
        logging: true,
      });
  
      const imgData = canvas.toDataURL('image/png', PDF_CONFIG.QUALITY);
      const pdf = new jsPDF(PDF_CONFIG.ORIENTATION, 'mm', PDF_CONFIG.PAGE_SIZE);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
  
      let heightLeft = imgHeight;
      let position = 0;
  
      // Добавляем первую страницу
      pdf.addImage(imgData, PDF_CONFIG.IMAGE_FORMAT, 0, position, pdfWidth, imgHeight, undefined, PDF_CONFIG.COMPRESSION);
      heightLeft -= pdfHeight;
  
      // Добавляем дополнительные страницы, если отчет длинный
      while (heightLeft > 0) {
        pdf.addPage();
        position -= pdfHeight;
        pdf.addImage(imgData, PDF_CONFIG.IMAGE_FORMAT, 0, position, pdfWidth, imgHeight, undefined, PDF_CONFIG.COMPRESSION);
        heightLeft -= pdfHeight;
      }
  
      const pdfBlob = pdf.output('blob');
  
      if (pdfBlob.size === 0) {
        throw new Error(PDF_ERROR_MESSAGES.EMPTY_PDF);
      }
  
      return pdfBlob;
    }, []);
  
    return { generatePDF };
  };
  
  // Хук для отправки в Telegram
export const useTelegramSender = () => {
    const sendToTelegram = useCallback(async (
      reportRef: React.RefObject<HTMLDivElement>,
      dateStartInStr: string,
      dateEndInStr: string
    ) => {
      try {
        const { generatePDF } = usePDFGenerator();
        const pdfBlob = await generatePDF(reportRef);
  
        // Проверка размера PDF
        const pdfSizeMB = pdfBlob.size / 1024 / 1024;
        if (pdfSizeMB > PDF_CONFIG.MAX_SIZE_MB) {
          alert(PDF_ERROR_MESSAGES.SIZE_EXCEEDED(pdfSizeMB, PDF_CONFIG.MAX_SIZE_MB));
          return;
        }
  
        const formData = new FormData();
        formData.append('document', pdfBlob, PDF_FILENAME_TEMPLATE(dateStartInStr, dateEndInStr));
  
        const response = await axios.post('/apifront/send-pdf', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
  
        alert(PDF_ERROR_MESSAGES.SEND_SUCCESS);
      } catch (error) {
        console.error('Error sending PDF to Telegram:', error);
        if (axios.isAxiosError(error)) {
          console.error('Axios error details:', error.response?.data);
        }
        alert(PDF_ERROR_MESSAGES.SEND_FAILED);
      }
    }, []);
  
    return { sendToTelegram };
  };