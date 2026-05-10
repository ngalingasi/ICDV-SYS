import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In – TPFCS Project Management System"
        description="Tanzania Police Force Corporation Sole – Project Management System"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
