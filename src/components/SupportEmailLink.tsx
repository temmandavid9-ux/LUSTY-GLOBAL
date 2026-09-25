import { Mail } from 'lucide-react';

export default function SupportEmailLink({ 
  email = "temmandavid9@gmail.com", 
  subject = "Lusty Global Support Inquiry",
  className = ""
}: { 
  email?: string; 
  subject?: string;
  className?: string;
}) {
  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

  return (
    <a
      href={mailtoUrl}
      className={`inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-sky-400 transition font-mono ${className}`}
    >
      <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
      <span className="underline decoration-zinc-700 underline-offset-2 hover:decoration-sky-400">{email}</span>
    </a>
  );
}
