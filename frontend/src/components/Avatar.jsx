export default function Avatar({ user, size = 38 }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (user?.avatar) return <img className="avatar-img" src={user.avatar} alt={user.name} style={style} />;
  return <div className="avatar" style={style}>{user?.name?.[0]?.toUpperCase()}</div>;
}
