// Logo aplikasi. Bentuknya sama dengan public/favicon.svg; ubah keduanya bersamaan.
export default function Logo({ size = 22, title = 'Node Visual Builder' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      // title kosong = dekoratif (mis. di samping teks nama aplikasi), disembunyikan dari screen reader
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect width="32" height="32" rx="7" fill="#4f46e5" />
      <g fill="none" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 10h4" />
        <path d="M10 14v7a2 2 0 0 0 2 2h3" />
      </g>
      <g fill="#ffffff">
        <rect x="6" y="6" width="8" height="8" rx="2" />
        <rect x="18" y="6" width="8" height="8" rx="2" />
        <rect x="15" y="19" width="8" height="8" rx="2" />
      </g>
    </svg>
  );
}