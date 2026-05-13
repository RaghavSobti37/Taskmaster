const getRandomAvatar = (gender = 'male') => {
  const g = gender.toLowerCase() === 'female' ? 'female' : 'male';
  const id = Math.floor(Math.random() * 50) + 1;
  return `https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/${g}/${id}.png`;
};

module.exports = { getRandomAvatar };
