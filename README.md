# jenalston.com

**Portfolio and blog for Jennifer Alston, SEO & AI Strategist.** *Discoverable by Design.*

🌐 **Live site:** [jenalston.com](https://jenalston.com)

This repository is the source for my portfolio site: a fast, SEO-first static site built to be easy for search engines *and* AI assistants to read, cite and recommend. It's also a working example of the approach I use with clients.

[![Visit the site](https://img.shields.io/badge/Visit%20jenalston.com-14142B?style=for-the-badge)](https://jenalston.com)
[![Read the blog](https://img.shields.io/badge/Read%20the%20blog-A084FF?style=for-the-badge)](https://jenalston.com/blog/)
[![Let's talk](https://img.shields.io/badge/Let's%20talk-FF7A59?style=for-the-badge)](https://jenalston.com/contact)

---

## 🧱 How it's built

| Part | What it uses |
|---|---|
| Pages | Hand-coded HTML and CSS, no page builder or framework |
| Blog | Jekyll, built automatically by GitHub Pages from Markdown posts |
| Hosting | GitHub Pages with a custom domain and enforced HTTPS |
| Contact form | Formspree, with a spam honeypot and a branded thank-you page |
| Interactive graphics | Vanilla JavaScript, with no outside libraries |
| Fonts | Syne, DM Sans, Fraunces and JetBrains Mono via Google Fonts |

## 🔎 SEO & AI-visibility features

- **Structured data:** Person schema on the home page; BlogPosting and FAQPage schema on blog posts
- **Unique metadata:** title, description, canonical URL and Open Graph tags on every page
- **Sitemap that updates itself:** new blog posts are added automatically, plus `robots.txt` and an RSS feed
- **Internal linking:** section-level jump links connect services, case studies and blog posts
- **Built for AI answers:** posts include key takeaways, a table of contents, "Quick answer" echo blocks for target prompts, an FAQ and a summary
- **Fast and accessible:** lightweight pages, responsive layouts, semantic headings, visible keyboard focus and descriptive alt text

## 📁 What's where

```
├── index.html          Home
├── about.html          About
├── case-studies.html   Case studies with interactive graphics
├── contact.html        Contact form and FAQ
├── thanks.html         Form confirmation page
├── 404.html            Not-found page
├── blog/index.html     Blog listing
├── _posts/             Blog posts (Markdown)
├── _layouts/post.html  Blog post template with schema
├── _includes/faq.html  FAQ block for posts
├── _config.yml         Jekyll settings
├── sitemap.xml         Sitemap (lists posts automatically)
├── robots.txt
├── favicon.svg
├── images/             Case study graphics
└── CNAME               Custom domain
```

## ✍️ Adding a blog post

1. In `_posts/`, create a file named `YYYY-MM-DD-post-title.md`.
2. Copy the front matter (the section between the `---` lines) from an existing post and update the title, description and date.
3. Write the post in Markdown below it and commit. GitHub Pages publishes it to the blog, the home page and the sitemap within a few minutes.

---

☕ Built with a lot of coffee. 🐈 Quality-checked by cats.

© 2026 Jennifer Alston · [jenalston.com](https://jenalston.com) · [LinkedIn](https://www.linkedin.com/in/jenniferalstonseostrategist/)
