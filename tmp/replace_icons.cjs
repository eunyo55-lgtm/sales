const { execSync } = require('child_process');

try {
    console.log('Converting Simple Naver icon...');
    execSync('npx -y png-to-ico "C:\\Users\\onlin\\.gemini\\antigravity\\brain\\9ea5969e-22ef-4a71-baed-b68cffb88098\\naver_simple_icon_1773190772825.png" > "C:\\Users\\onlin\\Desktop\\Sales\\scraper\\naver_icon.ico"');

    console.log('Converting Simple Coupang icon...');
    execSync('npx -y png-to-ico "C:\\Users\\onlin\\.gemini\\antigravity\\brain\\9ea5969e-22ef-4a71-baed-b68cffb88098\\coupang_simple_icon_1773190790058.png" > "C:\\Users\\onlin\\Desktop\\Sales\\scraper\\coupang_icon.ico"');

    console.log('Finished converting simple icons.');
} catch (e) {
    console.error('Error during conversion:', e.message);
}
