import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          borderRadius: 36,
        }}
      >
        <svg
          width="100"
          height="100"
          viewBox="0 0 32 32"
          fill="none"
          style={{ margin: 'auto' }}
        >
          <circle cx="10" cy="10" r="4" fill="white" />
          <circle cx="22" cy="10" r="4" fill="white" />
          <circle cx="16" cy="22" r="4" fill="white" />
          <path
            d="M14 14 L18 14 M16 14 L16 18 M14 18 L18 18"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
