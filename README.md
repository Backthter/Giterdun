# Giterdun 📒

Our shared planner for the application grind: jobs for one of us, a masters for the other.

- **Two personal boards** (left and right tabs): applications with their own tasks, to-dos, countdowns, a calendar, sticky notes, and cheers left for you.
- **Together page**: a garden that grows as you both finish tasks, a star jar per application sent, recent wins, a shared drag-and-drop pipeline of every application, a cheer wall, a combined calendar, shared to-dos and notes, and a high-five button.
- **Stickers**: click ✨ Stickers, upload PNGs into the shared sticker book, then stick them anywhere on any page. Drag to move; tap one to rotate, resize, bring to front or remove.

It's plain HTML/CSS/JS with no build step, so it runs straight from GitHub Pages.

## Try it locally

ES modules don't load from `file://`, so serve the folder:

```
npx http-server -p 5173 -c-1
```

then open http://localhost:5173. Without Supabase keys it saves to **this browser only**.

## Share it between both of you (Supabase, free)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in [`supabase-setup.sql`](supabase-setup.sql) and run it.
3. Under **Authentication → Sign In / Providers → Email**, you can turn off **Confirm email** to skip the confirmation email.
4. Under **Project Settings → API**, copy the **Project URL** and the **anon public** key into [`js/config.js`](js/config.js).
5. Open the site and each of you clicks **Create account**.
6. Once you both have accounts, go back to the Email provider settings and turn off **Allow new users to sign up**, so nobody else can join.

The anon key is meant to be public. The row-level security rules in the SQL file mean only signed-in users can read or write.

**Moving over data you made in browser-only mode:** before adding the keys, open ⚙️ Settings and click **Download backup**. After signing in, use **Restore backup**.

## Put it on GitHub Pages

1. Create a GitHub repo and push this folder to it.
2. In the repo, go to **Settings → Pages**, pick **Deploy from a branch**, choose `main` and `/ (root)`, and save.
3. After a minute it's live at `https://<your-username>.github.io/<repo-name>/`.
4. In Supabase, under **Authentication → URL Configuration**, set the Site URL to that address.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page shell |
| `css/style.css` | Notebook look |
| `js/app.js` | All the views and interactions |
| `js/store.js` | Saving and loading (browser storage or Supabase) |
| `js/config.js` | Your Supabase keys |
| `supabase-setup.sql` | Database and sticker storage setup |
