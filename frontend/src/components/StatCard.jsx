const toneClasses = {
  revenue: "from-teal/15 to-teal/5 text-teal",
  expense: "from-amber/15 to-amber/5 text-amber",
  dues: "from-slate-300/50 to-slate-100/80 text-slate-700",
  neutral: "from-white to-slate-100 text-slate-800"
};

const StatCard = ({ title, value, tone = "neutral", subtitle }) => {
  return (
    <div className={`panel bg-gradient-to-br ${toneClasses[tone]} p-4 sm:p-6`}>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted">{title}</p>
      <p className="mt-4 break-words text-2xl font-bold tracking-tight text-ink sm:text-3xl">{value}</p>
      {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
};

export default StatCard;
