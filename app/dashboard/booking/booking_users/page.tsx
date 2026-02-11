
type User = {
  id: number;
  name: string;
  email: string;
  company: string;
  number: string;
  role: string;
  description: string;
  posts: number;
};

const users: User[] = [
  {
    id: 1,
    name: "Janis Otmanis",
    email: "lalala@otman.no",
    company: "OtmanTransportAS",
    number: "+47 000 00 000",
    role: "Admin",
    description: "Owner of the business",
    posts: 1234,
  },
  {
    id: 2,
    name: "Test User",
    email: "test@test.no",
    company: "TestCompany",
    number: "+47 111 11 111",
    role: "User",
    description: "Handles bookings",
    posts: 986,
  },
  {
    id: 3,
    name: "Test User",
    email: "test@test.no",
    company: "TestCompany",
    number: "+47 111 11 111",
    role: "User",
    description: "Handles bookings",
    posts: 321,
  },
  {
    id: 4,
    name: "Test User",
    email: "test@test.no",
    company: "TestCompany",
    number: "+47 111 11 111",
    role: "User",
    description: "Handles bookings",
    posts: 412,
  },
];


export default function UserPage() {
  return (
    <div className="flex flex-col">
      <h1 className="text-4xl font-semibold text-logoblue mb-8 text-center">
        Booking Users
      </h1>

      <div className="max-w-420 mx-auto">
        <table className="w-full table-fixed min-w-275 border border-black/10">
          <thead>
            <tr>
              <th className="px-4 py-4 border bg-black/5 w-40">Name</th>
              <th className="px-4 py-4 border bg-black/5 w-50">Email</th>
              <th className="px-4 py-4 border bg-black/5 w-40">Company</th>
              <th className="px-4 py-4 border bg-black/5 w-40">Number</th>
              <th className="px-4 py-4 border bg-black/5 w-30">Role</th>
              <th className="px-4 py-4 border bg-black/5 w-auto">Description</th>
              <th className="px-4 py-4 border bg-black/5 w-20">Posts</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-black/10">
                <td className="px-2 py-2 wrap-break-word">{user.name}</td>
                <td className="px-2 py-2 wrap-break-word">{user.email}</td>
                <td className="px-2 py-2 wrap-break-word">{user.company}</td>
                <td className="px-2 py-2 wrap-break-word">{user.number}</td>
                <td className="px-2 py-2 wrap-break-word">{user.role}</td>

                <td className="px-2 py-2 align-top">
                  <div className="max-h-12 overflow-y-auto wrap-break-word pr-2">
                    {user.description}
                  </div>
                </td>

                <td className="px-2 py-2 wrap-break-word">{user.posts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
