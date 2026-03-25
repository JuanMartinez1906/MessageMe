interface Props {
  count: number;
}

export default function Badge({ count }: Props) {
  if (count === 0) return null;
  return (
    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-medium">
      {count > 99 ? '99+' : count}
    </span>
  );
}
