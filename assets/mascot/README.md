# Mascot assets

Drop the final 3D renders here, one PNG per expression, transparent background,
around 1024×1024:

    happy.png  proud.png  motivated.png  surprised.png
    delighted.png  worried.png  sad.png  sleepy.png

Then uncomment the matching lines in `src/components/mascot/mascotAssets.ts`.

`<Mascot />` uses an image as soon as one is registered and falls back to the
vector mascot otherwise, so expressions can be migrated one at a time without
ever breaking a screen.
