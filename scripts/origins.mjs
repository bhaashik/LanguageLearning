export function originAllowed(origin,configured,fallback){
  if(!origin)return true;
  return (configured||fallback).split(',').map(value=>value.trim()).filter(Boolean).includes(origin);
}
