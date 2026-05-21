const fs = require('fs');
const path = require('path');

/**
 * Electron 앱 아이콘 복사 및 리사이즈 스크립트
 * web-app의 logo.png를 build/icon.png로 복사하고, 필요시 리사이즈
 */

async function copyIcon() {
  const buildDir = path.join(__dirname, '..', 'build');
  const logoPaths = [
    path.join(__dirname, '..', '..', 'web-app', 'public', 'logo.png'),
    path.join(__dirname, '..', '..', 'web-app', 'dist', 'logo.png'),
  ];

  const outputPath = path.join(buildDir, 'icon.png');

  // build 디렉토리 생성
  fs.mkdirSync(buildDir, { recursive: true });

  // build/icon.png가 이미 존재하고 256x256 이상이면 그대로 사용
  if (fs.existsSync(outputPath)) {
    try {
      const sharp = require('sharp');
      const metadata = await sharp(outputPath).metadata();
      if (metadata.width >= 256 && metadata.height >= 256) {
        //console.log(`✅ Using existing icon.png (${metadata.width}x${metadata.height})`);
        return;
      } else {
        //console.log(`⚠️ Existing icon.png is too small (${metadata.width}x${metadata.height}), will replace...`);
      }
    } catch (error) {
      // sharp가 없거나 에러가 나면 그냥 덮어쓰기
      console.log('⚠️ Cannot verify icon size, will replace...');
    }
  }

  // logo.png 찾기
  let sourcePath = null;
  for (const logoPath of logoPaths) {
    if (fs.existsSync(logoPath)) {
      sourcePath = logoPath;
      //console.log(`Found logo at: ${logoPath}`);
      break;
    }
  }

  if (!sourcePath) {
    console.warn('⚠️ Logo file not found. Please ensure logo.png exists in web-app/public or web-app/dist');
    if (!fs.existsSync(outputPath)) {
      console.error('❌ No icon file available. Build will fail.');
      process.exit(1);
    }
    process.exit(0);
  }

  // sharp를 사용하여 리사이즈 (선택사항)
  // sharp가 없으면 그냥 복사만 수행
  try {
    const sharp = require('sharp');

    // 이미지 크기 확인
    const metadata = await sharp(sourcePath).metadata();
    //console.log(`Original image size: ${metadata.width}x${metadata.height}`);

    // 최소 256x256이 필요하므로, 작으면 리사이즈
    const minSize = 256;
    if (metadata.width < minSize || metadata.height < minSize) {
      const size = Math.max(metadata.width, metadata.height, minSize);
      //console.log(`Resizing to ${size}x${size}...`);

      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toFile(outputPath);

      const finalMetadata = await sharp(outputPath).metadata();
      //console.log(`✅ Icon resized and copied to: ${outputPath} (${finalMetadata.width}x${finalMetadata.height})`);
    } else {
      // 이미 충분히 크면 그냥 복사
      fs.copyFileSync(sourcePath, outputPath);
      const finalMetadata = await sharp(outputPath).metadata();
      //console.log(`✅ Icon copied to: ${outputPath} (${finalMetadata.width}x${finalMetadata.height})`);
    }
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      // sharp가 없으면 그냥 복사만 수행
      //console.log('⚠️ sharp not found, copying without resize...');
      //console.log('⚠️ Please ensure logo.png is at least 256x256 pixels');
      fs.copyFileSync(sourcePath, outputPath);
      //console.log(`✅ Icon copied to: ${outputPath}`);
    } else {
      onsole.error('❌ Error processing icon:', error.message);
      // 에러가 나도 빌드는 계속 진행
      fs.copyFileSync(sourcePath, outputPath);
      console.log(`✅ Icon copied to: ${outputPath} (fallback)`);
    }
  }
}

copyIcon().catch(error => {
  console.error('❌ Failed to copy icon:', error);
  process.exit(1);
});

