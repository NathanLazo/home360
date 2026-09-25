# Don Víctor — character cutouts (PNG, transparent)

Realistic 3D-render cutouts of Don Víctor extracted from the official
brand art (welcome-video storyboard + personality sheet), background
removed. For use across the landing and panel wherever the real
character is wanted instead of the pixel-art agent sprite.

| File | Pose | Suggested use |
|------|------|---------------|
| `portrait.png` | Face close-up, smiling | Avatars, chat header, testimonials |
| `arms-crossed.png` | Bust, arms crossed | Idle / "breathing", hero, cards |
| `greeting.png` | Bust, welcoming | Onboarding, empty states |
| `hand-on-chest.png` | Hand on chest (promise) | Trust / guarantee sections |
| `presenting.png` | Pointing sideways | Feature callouts, tooltips |
| `pointing-up.png` | Bust, attentive | Tips, announcements |
| `fingers-up.png` | Both index fingers up | Steps / "how it works" |

Cutouts are re-extracted with alpha matting and upscaled 4x with
Real-ESRGAN (620–830 px): usable at avatar, card and mid-page scale. High-resolution full-body and half-body sprites for
the seven chat states (`breathing`, `listening`, `connecting`,
`searching`, `working`, `solving`, `composing` — see
`src/components/agent/don-victor/don-victor-choreography.ts`) are
pending AI generation with character reference; they require a
`GEMINI_API_KEY` in the cloud environment.
