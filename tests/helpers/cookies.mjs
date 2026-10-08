// Adaptador exclusivo dos testes para simular o contexto assíncrono do Next.
export async function cookies() {
  const values = globalThis.psicoCookieTestContext.getStore();
  if (!values) throw new Error("Fora do contexto de uma requisição de teste.");
  return {
    get(name) {
      return values[name] === undefined ? undefined : { name, value: values[name] };
    },
  };
}
