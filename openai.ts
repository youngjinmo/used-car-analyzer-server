import { OpenAI } from 'openai';
import dotenv from 'dotenv';

const config = dotenv.config();
const openAiClient= new OpenAI({
    apiKey: process.env.secret_key,
    organization: process.env.organization_id
});

export default async function requestGpt({ model="gpt-4-turbo", prompt }: { model?: string; prompt: string }) {
    const response = await openAiClient.chat.completions.create({
        model,
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    });
    return response.choices[0].message.content;
}
