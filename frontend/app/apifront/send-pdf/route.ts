import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('document') as Blob;
    const chatId = process.env.TELEGRAM_USER_IDS;
    const botToken = process.env.BOT_TOKENBACKUP;

    if (!chatId || !botToken) {
      return NextResponse.json({ error: 'Missing Telegram configuration' }, { status: 500 });
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No valid document provided' }, { status: 400 });
    }

    formData.append('chat_id', chatId);

    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );

    return NextResponse.json({ message: 'PDF sent successfully', data: response.data });
  } catch (error) {
    console.error('Error sending PDF to Telegram:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', error.response?.data);
    }
    return NextResponse.json({ error: 'Failed to send PDF' }, { status: 500 });
  }
}