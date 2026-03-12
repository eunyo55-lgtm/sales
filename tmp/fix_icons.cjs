const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log('Converting Naver icon...');
    execSync('npx -y png-to-ico "C:\\Users\\onlin\\Desktop\\Sales\\tmp\\naver_256.png" > "C:\\Users\\onlin\\Desktop\\Sales\\scraper\\naver_icon.ico"');

    console.log('Converting Coupang icon...');
    execSync('npx -y png-to-ico "C:\\Users\\onlin\\Desktop\\Sales\\tmp\\coupang_256.png" > "C:\\Users\\onlin\\Desktop\\Sales\\scraper\\coupang_icon.ico"');

    console.log('Finished converting icons.');
} catch (e) {
    console.error('Error during conversion:', e.message);
}
