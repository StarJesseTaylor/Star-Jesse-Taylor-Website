# Website Setup Guide — Star Jesse Taylor Emotional Fitness

## Files Overview
```
emotional-fitness-website/
├── index.html       — Homepage
├── about.html       — About page
├── services.html    — Services / Work With Me page
├── apply.html       — Coaching application page
├── css/styles.css   — All styles
├── js/main.js       — All JavaScript
├── images/          — Put your images here
└── SETUP.md         — This file
```

---

## 1. Add Your Images

- **Headshot**: Save as `images/star-headshot.jpg` — then in `about.html`, replace the placeholder div with:
  ```html
  <img src="images/star-headshot.jpg" alt="Star Jesse Taylor" />
  ```

- **Book cover**: Save as `images/book-cover.jpg` — then in `index.html` and `about.html`, inside `.book-cover`, replace the text content with:
  ```html
  <img src="images/book-cover.jpg" alt="Emotional Fitness by Star Jesse Taylor" class="book-cover-img" />
  ```

---

## 2. Add Your YouTube Video

In `index.html`, find the `.vsl-placeholder` div and replace it with your YouTube embed:
```html
<iframe
  src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen>
</iframe>
```
Replace `YOUR_VIDEO_ID` with the ID from your YouTube URL (the part after `v=`).

---

## 3. Set Up Email Form Submissions (EmailJS — Free)

The application form sends to `starjessetaylor@gmail.com`. Here's how to activate it:

### Step 1 — Create a free EmailJS account
Go to emailjs.com and sign up free.

### Step 2 — Connect your Gmail
In EmailJS dashboard → Email Services → Add New Service → Gmail. Authorize with `starjessetaylor@gmail.com`. Note your **Service ID** (e.g., `service_abc123`).

### Step 3 — Create an Email Template
In EmailJS → Email Templates → Create New. Use this template:

**Subject:** New Coaching Application from {{applicant_name}}

**Body:**
```
New Coaching Application

{{message}}

---
Reply to: {{reply_to}}
```

Note your **Template ID** (e.g., `template_xyz789`).

### Step 4 — Get your Public Key
In EmailJS → Account → API Keys. Copy your **Public Key**.

### Step 5 — Add to apply.html
In `apply.html`, before the closing `</body>` tag, add:
```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
<script>emailjs.init('YOUR_PUBLIC_KEY');</script>
```

### Step 6 — Update js/main.js
In `main.js`, find this line:
```js
await emailjs.send('service_emotfit', 'template_application', {
```
Replace `service_emotfit` with your actual Service ID, and `template_application` with your actual Template ID.

---

## 4. Update Social Media Links

In each page's footer and nav, replace `href="#"` on the social links with your actual URLs:
- Instagram: `https://instagram.com/yourhandle`
- TikTok: `https://tiktok.com/@yourhandle`
- YouTube: `https://youtube.com/@yourhandle`

---

## 5. Deploy the Website

### Option A — Netlify (easiest, free)
1. Go to netlify.com → Create free account
2. Drag and drop the entire `emotional-fitness-website` folder onto the dashboard
3. Done — you get a live URL instantly
4. Connect your custom domain in Settings → Domain Management

### Option B — GitHub Pages (free)
1. Create a GitHub repo
2. Upload all files
3. Settings → Pages → Deploy from main branch

### Option C — Any web host
Upload the entire folder via FTP/SFTP. Point your domain to the folder.

---

## 6. Custom Domain

Once deployed, connect `starjessetaylor.com` or `emotionalfitness.com` through your hosting provider's domain settings.

---

## Placeholder Checklist
- [ ] Star's headshot → `images/star-headshot.jpg`
- [ ] Book cover image → `images/book-cover.jpg`
- [ ] YouTube video embed code → `index.html` VSL section
- [ ] Social media links → all 4 pages footer
- [ ] Book buy link → `index.html` and `about.html`
- [ ] Featured media logos → `about.html`
- [ ] EmailJS configured → `apply.html` + `js/main.js`
- [ ] Privacy policy page
- [ ] Terms of service page
