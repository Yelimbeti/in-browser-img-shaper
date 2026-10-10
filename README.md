# In Browser Img Shaper

Create a simple, modern, responsive website called **Image Resizer**.

The website should have only one purpose: allow users to resize images easily.

### Features
1. Upload an image from a computer or mobile device.
2. Display the uploaded image preview.
3. Change image width and height in pixels (px).
4. Maintain the original aspect ratio with a lock/unlock option.
5. Change image file size in KB by adjusting image quality and compression.
6. Support JPG, JPEG, PNG, and WebP formats.
7. Show the original image size and the resized image size.
8. Allow users to select the output format.
9. Provide a **Download Image** button to download the resized image.
10. Add a Reset button to restore the original settings.

### Design
- Clean, simple, professional interface.
- White background with blue accents.
- Upload area in the center.
- Width, height, target file size in KB, quality, and format controls below the preview.
- Responsive design for desktop and mobile.
- No login, registration, subscription, or payment required.

### Technical requirements
- Make every feature fully functional, not just a visual design.
- Process images directly in the browser wherever possible.
- Changing width and height must resize the actual image dimensions.
- Changing the target KB should attempt to compress the image to the requested file size and show the actual resulting size. Explain when the target cannot be achieved.
- Preserve image quality as much as possible.
- Allow users to download the final image.
- Do not add any other tools or unnecessary pages.

Build a complete, working image resizer website that is easy for anyone to use.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://in-browser-img-shaper.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f0d13f5a-393e-5a74-9866-78abccf7320f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
