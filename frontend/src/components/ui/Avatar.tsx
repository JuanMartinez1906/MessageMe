interface Props {
  name: string;
  url?: string | null;
  isOnline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };

export default function Avatar({ name, url, isOnline, size = 'md' }: Props) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative flex-shrink-0">
      {url ? (
        <img src={url} alt={name} className={`${sizes[size]} rounded-full object-cover`} />
      ) : (
        <div
          className={`${sizes[size]} rounded-full bg-teal-600 flex items-center justify-center font-semibold text-white`}
        >
          {initials}
        </div>
      )}
      {isOnline !== undefined && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#111b21] ${
            isOnline ? 'bg-green-400' : 'bg-gray-500'
          }`}
        />
      )}
    </div>
  );
}
