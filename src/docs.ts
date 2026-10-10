import { google } from 'googleapis';

interface AppendToDocParams {
  documentId: string;
  text: string;
}

export async function appendToGoogleDoc(authClient: any, params: AppendToDocParams) {
  const docs = google.docs({ version: 'v1', auth: authClient });

  const { documentId, text } = params;

  try {
    // Append text to the end of the document
    const res = await docs.documents.batchUpdate({
      documentId: documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              endOfSegmentLocation: {
                segmentId: '', // The body
              },
              text: text,
            },
          },
        ],
      },
    });

    return {
      success: true,
      documentId: res.data.documentId,
    };
  } catch (error: any) {
    console.error('Error appending to document:', error);
    throw new Error(`Failed to append to document: ${error.message}`);
  }
}
