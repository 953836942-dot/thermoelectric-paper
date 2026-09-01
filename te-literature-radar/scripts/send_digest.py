#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import os
import re
import smtplib
from email.message import EmailMessage
from pathlib import Path


def inline_html(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"\[(.+?)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', escaped)
    return escaped


def markdown_to_html(markdown: str) -> str:
    out = ['<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f5f6f8;color:#202124}main{max-width:800px;margin:auto;padding:24px}section{background:white;border:1px solid #ddd;border-radius:8px;padding:16px;margin:14px 0}.preprint{background:#fff7ed;border:1px solid #fdba74;padding:8px;font-weight:700}h2{margin-top:28px}</style></head><body><main>']
    in_section=False
    for line in markdown.splitlines():
        if line.startswith("# "): out.append(f"<h1>{inline_html(line[2:])}</h1>")
        elif line.startswith("## "):
            if in_section: out.append("</section>"); in_section=False
            out.append(f"<h2>{inline_html(line[3:])}</h2>")
        elif line.startswith("### "):
            if in_section: out.append("</section>")
            out.append(f"<section><h3>{inline_html(line[4:])}</h3>"); in_section=True
        elif "Preprint — not peer reviewed" in line: out.append(f'<div class="preprint">{inline_html(line.lstrip("- "))}</div>')
        elif line.startswith("- "): out.append(f"<p>{inline_html(line[2:])}</p>")
        elif line.startswith("|"): out.append(f"<pre>{html.escape(line)}</pre>")
        elif line.strip(): out.append(f"<p>{inline_html(line)}</p>")
    if in_section: out.append("</section>")
    out.append("</main></body></html>")
    return "\n".join(out)


def build_message(email_config, subject: str, body: str, html_body: str) -> EmailMessage:
    sender = email_config.get("from") or email_config.get("smtp_username")
    recipient = email_config.get("to")
    if not sender or not recipient: raise ValueError("missing sender/recipient")
    msg = EmailMessage(); msg["From"]=sender; msg["To"]=recipient; msg["Subject"]=subject
    msg.set_content(body); msg.add_alternative(html_body, subtype="html"); return msg


def load_smtp_password(email_config, config_dir: Path) -> str:
    env = email_config.get("smtp_password_env", "")
    if env and os.environ.get(env): return os.environ[env].strip()
    file = email_config.get("smtp_password_file", "")
    if file:
        path = Path(file); path = path if path.is_absolute() else config_dir / path
        if path.exists() and path.read_text(encoding="utf-8").strip(): return path.read_text(encoding="utf-8").strip()
    raise ValueError("missing SMTP password")


def send_message(email_config, message, password):
    with smtplib.SMTP(email_config["smtp_host"], int(email_config.get("smtp_port",587)), timeout=30) as smtp:
        smtp.ehlo()
        if email_config.get("use_starttls",True): smtp.starttls(); smtp.ehlo()
        smtp.login(email_config["smtp_username"], password); smtp.send_message(message)


def main():
    p=argparse.ArgumentParser(); p.add_argument("digest"); p.add_argument("--config",required=True); p.add_argument("--subject"); p.add_argument("--dry-run",action="store_true")
    a=p.parse_args(); cfg=json.loads(Path(a.config).read_text(encoding="utf-8")); ec=cfg.get("email") or {}
    if not ec.get("enabled"): raise SystemExit("Email is disabled in config.")
    body=Path(a.digest).read_text(encoding="utf-8"); subject=a.subject or f"TE Literature Radar - {Path(a.digest).stem}"
    msg=build_message(ec,subject,body,markdown_to_html(body))
    if a.dry_run: print(f"Ready to send: {msg['From']} -> {msg['To']}"); return
    send_message(ec,msg,load_smtp_password(ec,Path(a.config).parent)); print(f"Sent: {msg['To']}")

if __name__=="__main__": main()
