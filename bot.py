import os
import re
import shutil
import tempfile
from pathlib import Path
from dotenv import load_dotenv
import yt_dlp
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
load_dotenv()


BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

if not BOT_TOKEN:
    raise RuntimeError(
        "TELEGRAM_BOT_TOKEN environment variable nahi mila."
    )


# =========================
# INSTAGRAM URL CHECK
# =========================

def is_instagram_url(url: str) -> bool:
    pattern = r"^https?://(www\.)?instagram\.com/(reel|p|tv)/"
    return bool(re.match(pattern, url.strip(), re.IGNORECASE))


# =========================
# START
# =========================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):

    await update.message.reply_text(
        "👋 Welcome!\n\n"
        "📥 Instagram Reel ka public URL bhejo.\n\n"
        "Example:\n"
        "https://www.instagram.com/reel/xxxxx/"
    )


# =========================
# HANDLE URL
# =========================

async def handle_message(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    url = (update.message.text or "").strip()

    if not is_instagram_url(url):

        await update.message.reply_text(
            "❌ Valid Instagram Reel/Post URL bhejo."
        )

        return

    status = await update.message.reply_text(
        "⏳ Reel download ho rahi hai...\n"
        "Thoda wait karo."
    )

    temp_dir = Path(
        tempfile.mkdtemp(
            prefix="instagram_reel_"
        )
    )

    try:

        output_template = str(
            temp_dir / "%(title).80s.%(ext)s"
        )

        options = {
    "outtmpl": output_template,
    "noplaylist": True,
    "quiet": False,
    "no_warnings": False,
    "restrictfilenames": True,

    "format": "best[ext=mp4]/best",

    "socket_timeout": 120,
    "retries": 10,
    "fragment_retries": 10,

    "http_headers": {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/151.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    },
     }

        with yt_dlp.YoutubeDL(options) as ydl:

            info = ydl.extract_info(
                url,
                download=True
            )

        video_files = [
            file
            for file in temp_dir.iterdir()
            if file.is_file()
            and file.suffix.lower()
            in {".mp4", ".webm", ".mkv"}
        ]

        if not video_files:

            raise RuntimeError(
                "Video file nahi mili."
            )

        video_file = video_files[0]

        await status.edit_text(
            "📤 Video Telegram par bheji ja rahi hai..."
        )

        with open(video_file, "rb") as video:

            await update.message.reply_document(
            document=video,
            caption="✅ Reel download complete!"
         )

        await status.delete()

    except Exception as error:

        print(
            "wait...:",
            error
        )

        await status.edit_text(
            "❌ Reel download nahi ho payi.\n\n"
            "Possible reasons:\n"
            "• Reel private hai\n"
            "• Instagram login/cookies maang raha hai\n"
            "• URL invalid hai\n"
            "• Reel available nahi hai"
        )

    finally:

        shutil.rmtree(
            temp_dir,
            ignore_errors=True
        )


# =========================
# MAIN
# =========================

def main():

    print(
        "Instagram Telegram Bot starting..."
    )

    application = (
    Application.builder()
    .token(BOT_TOKEN)
    .connect_timeout(60)
    .read_timeout(60)
    .write_timeout(120)
    .pool_timeout(60)
    .build()
)

    application.add_handler(
        CommandHandler(
            "start",
            start
        )
    )

    application.add_handler(
        MessageHandler(
            filters.TEXT
            & ~filters.COMMAND,
            handle_message
        )
    )

    print(
        "Bot is running..."
    )

    application.run_polling()


if __name__ == "__main__":

    main()
