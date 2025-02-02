import { AttachmentBuilder } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from "url";
import { createRequire } from 'module';
import { Readable } from 'stream';
import { promisify } from 'util';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const unlinkAsync = promisify(fs.unlink);  // Properly promisify unlink

// Helper function to safely delete a file
const safeDelete = async (path) => {
    try {
        await unlinkAsync(path);
    } catch (error) {
        if (error.code !== 'ENOENT') { // Ignore errors about files that don't exist
            console.error(`Failed to delete ${path}:`, error);
        }
    }
};

// Helper function to handle file download with timeout and cleanup
const downloadFile = async (url, path, timeout = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const fileStream = fs.createWriteStream(path);
        await pipeline(Readable.fromWeb(response.body), fileStream);
    } finally {
        clearTimeout(timeoutId);
    }
};

export const Command = {
    name: "addaudio",
    description: "Add audio to a video",
    options: [
        {
            name: "video",
            description: "The video you want to add audio to",
            type: 11,
            required: true,
        },
        {
            name: "audio",
            description: "The audio you want to add to the video",
            type: 11,
            required: true,
        },
    ],
    run: async (client, interaction) => {
        await interaction.deferReply();

        const tempFiles = [];
        
        try {
            // Validate file sizes and types
            const video = interaction.options.get("video").attachment;
            const audio = interaction.options.get("audio").attachment;
            
            const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
            if (video.size > MAX_FILE_SIZE || audio.size > MAX_FILE_SIZE) {
                throw new Error('File size too large (max 100MB)');
            }

            // Generate unique file paths with random component to prevent collisions
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 10000);
            const tempVideoPath = join(__dirname, `temp_video_${timestamp}_${random}.mp4`);
            const tempAudioPath = join(__dirname, `temp_audio_${timestamp}_${random}.mp3`);
            const outputPath = join(__dirname, `output_${timestamp}_${random}.mp4`);
            
            tempFiles.push(tempVideoPath, tempAudioPath, outputPath);

            // Download files with timeout
            await Promise.all([
                downloadFile(video.url, tempVideoPath),
                downloadFile(audio.url, tempAudioPath)
            ]);

            // Process video with progress tracking
            await new Promise((resolve, reject) => {
                let progress = 0;
                
                ffmpeg()
                    .input(tempVideoPath)
                    .input(tempAudioPath)
                    .outputOptions([
                        '-c:v copy',
                        '-c:a aac',
                        '-map 0:v:0',
                        '-map 1:a:0',
                        '-shortest',
                        '-movflags +faststart'
                    ])
                    .on('progress', (info) => {
                        const newProgress = Math.floor(info.percent);
                        if (newProgress > progress && newProgress % 20 === 0) {
                            progress = newProgress;
                            interaction.editReply(`Processing: ${progress}%`).catch(() => {});
                        }
                    })
                    .on('error', (err, stdout, stderr) => {
                        reject(new Error(`FFmpeg error: ${err.message}\nstderr: ${stderr}`));
                    })
                    .save(outputPath)
                    .on('end', resolve);
            });

            // Send the processed video
            const attachment = new AttachmentBuilder(outputPath, { 
                name: 'processed_video.mp4',
                description: 'Video with added audio'
            });
            
            await interaction.editReply({ 
                content: 'Processing complete!',
                files: [attachment] 
            });

        } catch (error) {
            console.error('Error in addaudio command:', error);
            
            const errorMessage = error.message.includes('size too large') 
                ? 'Files must be under 100MB each.'
                : 'There was an error processing your video. Please make sure both files are valid and try again.';
            
            await interaction.editReply({
                content: errorMessage,
                ephemeral: true
            });
        } finally {
            for (const file of tempFiles) {
                await safeDelete(file);
            }
        }
    }
};