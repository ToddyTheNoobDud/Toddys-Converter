import { AttachmentBuilder, ApplicationCommandOptionType } from 'discord.js';
import { spawn } from 'child_process';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from "url";
import { createRequire } from 'module';
import { Readable } from 'stream';
import { promisify } from 'util';
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const unlinkAsync = promisify(fs.unlink);

const VIDEO_FORMATS = {
    mp4: { ext: 'mp4', codec: 'libx264' },
    mov: { ext: 'mov', codec: 'libx264' },
    webm: { ext: 'webm', codec: 'libvpx-vp9' },
    avi: { ext: 'avi', codec: 'libx264' },
    mkv: { ext: 'mkv', codec: 'libx264' },
    gif: { ext: 'gif', codec: 'gif' }
};

const QUALITY_PRESETS = {
    high: { crf: 20, preset: 'medium', audioBitrate: '192k' },
    medium: { crf: 23, preset: 'medium', audioBitrate: '128k' },
    low: { crf: 26, preset: 'fast', audioBitrate: '96k' },
    ultralow: { crf: 30, preset: 'veryfast', audioBitrate: '64k' }
};

const getCompressionProfile = (fileSize, quality, resolution) => {
    const baseSettings = QUALITY_PRESETS[quality];
    const sizeMB = fileSize / (1024 * 1024);
    
    // Adjust compression settings based on resolution
    if (resolution === "2160") { // 4K
        baseSettings.crf += 2; // Increase CRF for larger resolution
        baseSettings.audioBitrate = '192k'; // Higher audio bitrate for better quality
    } else if (resolution === "1440") { // 1440p
        baseSettings.crf += 1; // Slightly increase CRF
        baseSettings.audioBitrate = '128k'; // Moderate audio bitrate
    } else if (resolution === "1080") { // 1080p
        baseSettings.crf = Math.min(baseSettings.crf, 23); // Keep CRF reasonable
    } else if (resolution === "720") { // 720p
        baseSettings.crf = Math.min(baseSettings.crf, 26); // Keep CRF reasonable
    } else if (resolution === "480" || resolution === "360") { // Lower resolutions
        baseSettings.crf = Math.min(baseSettings.crf, 30); // Allow higher CRF
    }

    return baseSettings;
};

const safeDelete = async (path) => {
    try {
        await unlinkAsync(path);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`Failed to delete ${path}:`, error);
        }
    }
};

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

const processVideo = async (inputPath, outputPath, options, interaction) => {
    const { format, quality, resolution, fps, fileSize } = options;
    const formatSettings = VIDEO_FORMATS[format];
    const compressionSettings = getCompressionProfile(fileSize, quality, resolution);

    return new Promise((resolve, reject) => {
        const ffmpegArgs = [
            '-i', inputPath,
            '-c:v', formatSettings.codec,
            '-preset', compressionSettings.preset,
            '-crf', compressionSettings.crf.toString(),
            '-movflags', '+faststart',
            '-b:a', compressionSettings.audioBitrate,
            '-y', // Overwrite output files without asking
            '-vf', resolution !== "original" ? `scale=${resolution === "2160" ? "3840:2160" : resolution === "1440" ? "2560:1440" : resolution === "1080" ? "1920:1080" : resolution === "720" ? "1280:720" : "640:360"}` : 'scale=iw:ih', // Set resolution
            ...(fps !== "original" ? ['-r', fps] : []), // Set frame rate if not original
            outputPath
        ];

        console.log(`FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`); // Log the command for debugging

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
        
        ffmpegProcess.stderr.on('data', (data) => {
            const message = data.toString();
            console.log(`FFmpeg: ${message}`);
        });

        ffmpegProcess.on('error', (err) => {
            reject(new Error(`FFmpeg error: ${err.message}`));
        });

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg process exited with code: ${code}`));
            }
        });
    });
};

export const Command = {
    name: "convert",
    description: "Convert video to different formats with advanced compression",
    options: [
        {
            name: "video",
            description: "The video to convert",
            type: ApplicationCommandOptionType.Attachment,
            required: true,
        },
        {
            name: "format",
            description: "Output video format",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: Object.keys(VIDEO_FORMATS).map(format => ({
                name: format.toUpperCase(),
                value: format
            }))
        },
        {
            name: "quality",
            description: "Video quality preset",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: Object.keys(QUALITY_PRESETS).map(quality => ({
                name: quality.charAt(0).toUpperCase() + quality.slice(1),
                value: quality
            }))
        },
        {
            name: "resolution",
            description: "Output resolution (e.g., 720p, 1080p)",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
                { name: "Original", value: "original" },
                { name: "4K (2160p)", value: "2160" },
                { name: "1440p", value: "1440" },
                { name: "1080p", value: "1080" },
                { name: "720p", value: "720" },
                { name: "480p", value: "480" },
                { name: "360p", value: "360" }
            ]
        },
        {
            name: "fps",
            description: "Frames per second for the output video",
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
                { name: "Original", value: "original" },
                { name: "60 FPS", value: "60" },
                { name: "30 FPS", value: "30" },
                { name: "24 FPS", value: "24" }
            ]
        }
    ],
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        let choices = [];
        switch (focusedOption.name) {
            case 'format':
                choices = Object.keys(VIDEO_FORMATS).map(format => ({
                    name: format.toUpperCase(),
                    value: format
                }));
                break;
            case 'quality':
                choices = Object.keys(QUALITY_PRESETS).map(quality => ({
                    name: quality.charAt(0).toUpperCase() + quality.slice(1),
                    value: quality
                }));
                break;
            case 'resolution':
                choices = [
                    { name: "Original", value: "original" },
                    { name: "4K (2160p)", value: "2160" },
                    { name: "1440p", value: "1440" },
                    { name: "1080p", value: "1080" },
                    { name: "720p", value: "720" },
                    { name: "480p", value: "480" },
                    { name: "360p", value: "360" }
                ];
                break;
            case 'fps':
                choices = [
                    { name: "Original", value: "original" },
                    { name: "60 FPS", value: "60" },
                    { name: "30 FPS", value: "30" },
                    { name: "24 FPS", value: "24" }
                ];
                break;
        }
        const filtered = choices.filter(choice => 
            choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        await interaction.respond(filtered.slice(0, 25));
    },
    async run(client, interaction) {
        await interaction.deferReply();
        const tempFiles = [];
        const startTime = Date.now(); // Start time for processing
        try {
            const video = interaction.options.get("video").attachment;
            const format = interaction.options.get("format").value;
            const quality = interaction.options.get("quality")?.value || "medium";
            const resolution = interaction.options.get("resolution")?.value || "original";
            const fps = interaction.options.get("fps")?.value || "original";
            const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
            
            if (!Object.keys(VIDEO_FORMATS).includes(extname(video.name).slice(1))) {
                throw new Error('Invalid video format. Supported formats: ' + Object.keys(VIDEO_FORMATS).join(', '));
            }
            if (video.size > MAX_FILE_SIZE) {
                throw new Error('File size too large (max 100MB)');
            }

            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 10000);
            const tempInputPath = join(__dirname, `temp_input_${timestamp}_${random}.mp4`);
            const outputPath = join(__dirname, `output_${timestamp}_${random}.${VIDEO_FORMATS[format].ext}`);
            tempFiles.push(tempInputPath, outputPath);

            await downloadFile(video.url, tempInputPath);
            // Process video with enhanced settings
            await processVideo(tempInputPath, outputPath, {
                format,
                quality,
                resolution,
                fps,
                fileSize: video.size
            }, interaction);

            const finalStats = fs.statSync(outputPath);
            const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2); // Time in seconds
            const compressionRatio = ((1 - (finalStats.size / video.size)) * 100).toFixed(1);
            const attachment = new AttachmentBuilder(outputPath, { 
                name: `converted_video.${VIDEO_FORMATS[format].ext}`,
                description: `Converted to ${format.toUpperCase()}`
            });

            await interaction.editReply({
                content: `Conversion complete!\nFormat: ${format.toUpperCase()}\nQuality: ${quality}\n${
                    resolution !== "original" ? `Resolution: ${resolution}p\n` : ''
                }Frame Rate: ${fps !== "original" ? fps + " FPS\n" : ''}Size reduction: ${compressionRatio}%\nOriginal size: ${(video.size / 1024 / 1024).toFixed(2)}MB\nNew size: ${(finalStats.size / 1024 / 1024).toFixed(2)}MB\nTime taken: ${timeTaken} seconds`,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error in convert command:', error);
            const errorMessage = error.message.includes('size too large') 
                ? 'File must be under 100MB.'
                : error.message.includes('Invalid video format')
                ? error.message
                : 'There was an error converting your video. Please make sure the file is valid and try again.';
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
