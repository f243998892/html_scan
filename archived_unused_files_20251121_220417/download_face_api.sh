#!/bin/bash

# 下载face-api.js和模型文件

echo "开始下载face-api.js库和模型文件..."

# 创建目录
mkdir -p /var/www/product_system_dev/js/libs
mkdir -p /var/www/product_system_dev/models

# 下载face-api.js库
echo "1. 下载face-api.js..."
cd /var/www/product_system_dev/js/libs

# 尝试多个CDN源
if ! curl -f -o face-api.min.js https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js 2>/dev/null; then
    echo "   unpkg失败，尝试jsdelivr..."
    if ! curl -f -o face-api.min.js https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js 2>/dev/null; then
        echo "   jsdelivr失败，尝试cdnjs..."
        curl -f -o face-api.min.js https://cdnjs.cloudflare.com/ajax/libs/face-api.js/0.22.2/face-api.min.js 2>/dev/null
    fi
fi

if [ -f "face-api.min.js" ]; then
    echo "   ✅ face-api.js 下载成功 ($(du -h face-api.min.js | cut -f1))"
else
    echo "   ❌ face-api.js 下载失败"
    exit 1
fi

# 下载模型文件
echo "2. 下载模型文件..."
cd /var/www/product_system_dev/models

# Tiny Face Detector (最快，推荐)
echo "   下载 tiny_face_detector_model..."
curl -f -o tiny_face_detector_model-weights_manifest.json https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json 2>/dev/null
curl -f -o tiny_face_detector_model-shard1 https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1 2>/dev/null

# Face Landmark 68 Model
echo "   下载 face_landmark_68_model..."
curl -f -o face_landmark_68_model-weights_manifest.json https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json 2>/dev/null
curl -f -o face_landmark_68_model-shard1 https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1 2>/dev/null

# Face Recognition Model
echo "   下载 face_recognition_model..."
curl -f -o face_recognition_model-weights_manifest.json https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json 2>/dev/null
curl -f -o face_recognition_model-shard1 https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1 2>/dev/null
curl -f -o face_recognition_model-shard2 https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2 2>/dev/null

echo ""
echo "下载完成！文件列表："
echo "========================================="
ls -lh /var/www/product_system_dev/models/
echo ""
echo "face-api.js:"
ls -lh /var/www/product_system_dev/js/libs/face-api.min.js
