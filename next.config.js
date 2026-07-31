/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/extension.zip',
        headers: [
          { key: 'Content-Type', value: 'application/zip' },
          { key: 'Content-Disposition', value: 'attachment; filename="extension.zip"' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
