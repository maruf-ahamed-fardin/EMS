import SearchForm from '@/components/SearchForm';

export default function SearchPage() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-slate-800">Find a Team Member</h1>
        <p className="mt-1 text-sm text-slate-400">Search by username or employee ID</p>
      </div>
      <SearchForm />
    </div>
  );
}
